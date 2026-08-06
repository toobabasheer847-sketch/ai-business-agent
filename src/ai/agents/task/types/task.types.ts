export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskRecord {
  id: string;
  tenantId: string;
  createdBy: string;
  assignedTo?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt?: Date | string | null;
  completedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export interface TaskContext {
  userId: string;
  tenantId: string;
  email?: string;
}

export interface TaskAgentResponse {
  action: 'create' | 'get' | 'list' | 'update' | 'complete' | 'cancel';
  data: TaskRecord | TaskRecord[] | null;
  message?: string;
}
