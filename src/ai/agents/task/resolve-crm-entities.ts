import { Injectable, UnauthorizedException } from '@nestjs/common';

import { CompanyRepository } from '../../../modules/company/company.repository';
import { LeadRepository } from '../../../modules/lead/lead.repository';
import { ProspectRepository } from '../../../modules/prospect/prospect.repository';
import type { CrmReferences } from './parse-crm-references.js';

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

    return {
      status: 'resolved',
      company,
      person: people[0],
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
    ].filter((row) => row.name);

    return people;
  }
}

function formatPersonName(
  firstName?: string | null,
  lastName?: string | null,
): string {
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}
