import { Injectable, UnauthorizedException } from '@nestjs/common';

import { CompanyRepository } from '../../../modules/company/company.repository';
import { LeadRepository } from '../../../modules/lead/lead.repository';
import { ProspectRepository } from '../../../modules/prospect/prospect.repository';
import type { CrmReferences } from './parse-crm-references.js';
import {
  normalizeCrmIds,
  rejectMissingTenantCrm,
  type TaskCrmIds,
} from './resolve-crm-ids.js';

export type ResolvedCrmPersonKind = 'prospect' | 'lead';

export interface ResolvedCrmCompany {
  kind: 'company';
  id: string;
  name: string;
}

export interface ResolvedCrmPerson {
  kind: ResolvedCrmPersonKind;
  id: string;
  name: string;
  email?: string | null;
  companyId?: string | null;
}

export type CrmResolution =
  | { status: 'none' }
  | {
      status: 'resolved';
      company?: ResolvedCrmCompany;
      person?: ResolvedCrmPerson;
    }
  | {
      status: 'ambiguous';
      kind: 'company' | 'person';
      query: string;
      matches: string[];
    }
  | { status: 'missing'; kind: 'company'; query: string };

@Injectable()
export class TaskCrmResolver {
  constructor(
    private readonly companyRepository: CompanyRepository,
    private readonly prospectRepository: ProspectRepository,
    private readonly leadRepository: LeadRepository,
  ) {}

  async assertIds(tenantId: string, ids: TaskCrmIds): Promise<TaskCrmIds> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    const normalized = normalizeCrmIds(ids);

    if (normalized.companyId) {
      const company = await this.companyRepository.findByIdAndTenant(
        normalized.companyId,
        tenantId,
      );
      if (!company || company.tenantId !== tenantId) {
        rejectMissingTenantCrm('Company');
      }
    }

    if (normalized.prospectId) {
      const prospect = await this.prospectRepository.findByIdAndTenant(
        normalized.prospectId,
        tenantId,
      );
      if (!prospect || prospect.tenantId !== tenantId) {
        rejectMissingTenantCrm('Prospect');
      }
    }

    if (normalized.leadId) {
      const lead = await this.leadRepository.findByIdAndTenant(
        normalized.leadId,
        tenantId,
      );
      if (!lead || lead.tenantId !== tenantId) {
        rejectMissingTenantCrm('Lead');
      }
    }

    return normalized;
  }

  async resolve(
    refs: CrmReferences,
    tenantId: string,
  ): Promise<CrmResolution> {
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required');
    }

    if (!refs.companyQuery && !refs.personQuery && !refs.emailQuery) {
      return { status: 'none' };
    }

    let company: ResolvedCrmCompany | undefined;

    if (refs.companyQuery) {
      const companies = await this.searchCompanies(refs.companyQuery, tenantId);

      if (companies.length > 1) {
        return {
          status: 'ambiguous',
          kind: 'company',
          query: refs.companyQuery,
          matches: companies.map((row) => row.name),
        };
      }

      if (companies.length === 1) {
        company = companies[0];
      } else if (refs.explicitCompany) {
        return {
          status: 'missing',
          kind: 'company',
          query: refs.companyQuery,
        };
      }
    }

    const personQuery = refs.emailQuery || refs.personQuery;
    if (!personQuery) {
      return company
        ? { status: 'resolved', company }
        : { status: 'none' };
    }

    const people = await this.searchPeople(personQuery, tenantId, company?.id);

    if (people.length > 1) {
      return {
        status: 'ambiguous',
        kind: 'person',
        query: personQuery,
        matches: people.map((row) => row.name),
      };
    }

    if (people.length === 1) {
      return {
        status: 'resolved',
        company,
        person: people[0],
      };
    }

    if (!refs.emailQuery && refs.personQuery && !company) {
      const companies = await this.searchCompanies(refs.personQuery, tenantId);

      if (companies.length > 1) {
        return {
          status: 'ambiguous',
          kind: 'company',
          query: refs.personQuery,
          matches: companies.map((row) => row.name),
        };
      }

      if (companies.length === 1) {
        return { status: 'resolved', company: companies[0] };
      }
    }

    return {
      status: 'resolved',
      company,
      person: undefined,
    };
  }

  private async searchCompanies(
    query: string,
    tenantId: string,
  ): Promise<ResolvedCrmCompany[]> {
    const rows = await this.companyRepository.findAllByTenant(tenantId, query);

    return rows
      .filter((row) => row.tenantId === tenantId)
      .map((row) => ({
        kind: 'company' as const,
        id: row.id,
        name: row.name,
      }));
  }

  private async searchPeople(
    query: string,
    tenantId: string,
    companyId?: string,
  ): Promise<ResolvedCrmPerson[]> {
    const scoped = companyId ? { search: query, companyId } : { search: query };

    let prospects = await this.prospectRepository.findAllByTenant(
      tenantId,
      scoped,
    );
    let leads = await this.leadRepository.findAllByTenant(tenantId, scoped);

    if (companyId && prospects.length + leads.length === 0) {
      prospects = await this.prospectRepository.findAllByTenant(tenantId, {
        search: query,
      });
      leads = await this.leadRepository.findAllByTenant(tenantId, {
        search: query,
      });
    }

    const people: ResolvedCrmPerson[] = [
      ...prospects
        .filter((row) => row.tenantId === tenantId)
        .map((row) => ({
          kind: 'prospect' as const,
          id: row.id,
          name: formatPersonName(row.firstName, row.lastName),
          email: row.email,
          companyId: row.companyId,
        })),
      ...leads
        .filter((row) => row.tenantId === tenantId)
        .map((row) => ({
          kind: 'lead' as const,
          id: row.id,
          name: formatPersonName(row.firstName, row.lastName),
          email: row.email,
          companyId: row.companyId,
        })),
    ].filter((row) => personLooksLikeQuery(row, query));

    return people;
  }
}

function personLooksLikeQuery(
  person: { name: string; email?: string | null },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle || !person.name) {
    return false;
  }

  const name = person.name.trim().toLowerCase();
  if (name === needle || name.startsWith(`${needle} `) || name.endsWith(` ${needle}`)) {
    return true;
  }
  if (name.split(/\s+/).some((part) => part === needle || part.startsWith(needle))) {
    return true;
  }

  const email = person.email?.trim().toLowerCase();
  if (!email) {
    return false;
  }

  return email === needle || email.startsWith(`${needle}@`);
}

function formatPersonName(
  firstName?: string | null,
  lastName?: string | null,
): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}
