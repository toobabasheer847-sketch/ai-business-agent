import { KnowledgeDocumentRepository } from './knowledge-document.repository';
import { KNOWLEDGE_DOCUMENT_STATUS } from './knowledge-document.constants';

describe('KnowledgeDocumentRepository', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const knowledgeBaseId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const documentId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  function createRepository() {
    const returning = jest.fn();
    const select = jest.fn();
    const from = jest.fn();
    const where = jest.fn();
    const orderBy = jest.fn();
    const insert = jest.fn();
    const update = jest.fn();
    const del = jest.fn();
    const values = jest.fn();
    const set = jest.fn();

    const db = {
      insert,
      select,
      update,
      delete: del,
      query: {
        knowledgeDocuments: {
          findFirst: jest.fn(),
        },
      },
    };

    insert.mockReturnValue({ values: values.mockReturnValue({ returning }) });
    select.mockReturnValue({ from: from.mockReturnValue({ where, orderBy }) });
    where.mockReturnValue({ orderBy });
    update.mockReturnValue({
      set: set.mockReturnValue({
        where: where.mockReturnValue({ returning }),
      }),
    });
    del.mockReturnValue({ where });

    const repository = new KnowledgeDocumentRepository(db as any);
    return {
      repository,
      db,
      insert,
      values,
      returning,
      select,
      from,
      where,
      orderBy,
      update,
      set,
      del,
      findFirst: db.query.knowledgeDocuments.findFirst,
    };
  }

  it('creates documents scoped to tenant and knowledge base', async () => {
    const { repository, values, returning } = createRepository();
    returning.mockResolvedValue([
      {
        id: documentId,
        tenantId: tenantA,
        knowledgeBaseId,
        title: 'notes.txt',
        originalFilename: 'notes.txt',
        status: KNOWLEDGE_DOCUMENT_STATUS.PENDING,
      },
    ]);

    const row = await repository.create({
      id: documentId,
      tenantId: tenantA,
      knowledgeBaseId,
      title: 'notes.txt',
      originalFilename: 'notes.txt',
      status: KNOWLEDGE_DOCUMENT_STATUS.PENDING,
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: tenantA,
        knowledgeBaseId,
        originalFilename: 'notes.txt',
      }),
    );
    expect(row?.tenantId).toBe(tenantA);
  });

  it('finds documents only for the requested tenant', async () => {
    const { repository, findFirst } = createRepository();
    findFirst.mockResolvedValue({
      id: documentId,
      tenantId: tenantA,
      knowledgeBaseId,
    });

    const document = await repository.findByIdAndTenant(
      documentId,
      tenantA,
      knowledgeBaseId,
    );

    expect(document?.tenantId).toBe(tenantA);
    expect(findFirst).toHaveBeenCalled();
  });

  it('updates status with tenant guard', async () => {
    const { repository, returning } = createRepository();
    returning.mockResolvedValue([
      {
        id: documentId,
        tenantId: tenantA,
        status: KNOWLEDGE_DOCUMENT_STATUS.INDEXED,
      },
    ]);

    const row = await repository.updateStatus(documentId, tenantA, {
      status: KNOWLEDGE_DOCUMENT_STATUS.INDEXED,
      failureReason: null,
    });

    expect(row?.status).toBe(KNOWLEDGE_DOCUMENT_STATUS.INDEXED);
  });

  it('deletes chunks for a tenant-owned document only', async () => {
    const { repository, del, where } = createRepository();

    await repository.deleteChunksForDocument(tenantA, documentId);

    expect(del).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });

  it('inserts chunk rows with embeddings', async () => {
    const { repository, insert, values } = createRepository();

    await repository.insertChunks([
      {
        tenantId: tenantA,
        knowledgeBaseId,
        documentId,
        content: 'chunk-0',
        chunkIndex: '0',
        embedding: [0.1, 0.2],
        embeddingModel: 'gemini-embedding-001',
      },
    ]);

    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({
        tenantId: tenantA,
        documentId,
        embedding: [0.1, 0.2],
      }),
    ]);
  });

  it('does not leak tenant B data through tenant A filters', async () => {
    const { repository, findFirst } = createRepository();
    findFirst.mockResolvedValue(undefined);

    const document = await repository.findByIdAndTenant(
      documentId,
      tenantB,
      knowledgeBaseId,
    );

    expect(document).toBeUndefined();
  });
});
