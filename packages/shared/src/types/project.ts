export type ProjectSharing = 'private' | 'team';

export interface Project {
  id: string;
  name: string;
  context: string | null;
  color: string;
  sharing: ProjectSharing;
  userId: string;
  teamId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectWithThreadCount extends Project {
  threadCount: number;
}

export interface CreateProjectRequest {
  name: string;
  color: string;
  context?: string;
  teamId?: string;
  sharing?: ProjectSharing;
}

export interface UpdateProjectRequest {
  name?: string;
  color?: string;
  context?: string | null;
  sharing?: ProjectSharing;
}
