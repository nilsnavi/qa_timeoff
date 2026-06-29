export interface ImportUserRow {
  fullName: string;
  email: string;
  role: string;
  teamName?: string;
  position?: string;
}

export interface ImportUserResult {
  fullName: string;
  email: string;
  tempPassword: string | null;
  status: 'created' | 'skipped' | 'error';
  reason?: string;
}
