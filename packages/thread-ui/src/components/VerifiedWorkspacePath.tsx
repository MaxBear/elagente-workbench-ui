import { useEffect, useState, type ReactNode } from 'react';
import { WorkspaceFileLink } from './WorkspaceFileLink';
import type { WorkspacePathResolver } from './workspacePathLinks';

export function VerifiedWorkspacePath({ target, resolve, onOpen, children }: {
  target: { path: string; line?: number };
  resolve: WorkspacePathResolver;
  onOpen: (input: { path: string; line?: number }) => void;
  children: ReactNode;
}) {
  const [verified, setVerified] = useState<{ path: string; resolve: WorkspacePathResolver } | null>(null);
  useEffect(() => {
    let current = true;
    void resolve(target.path).then(exists => {
      if (current) setVerified(exists ? { path: target.path, resolve } : null);
    }).catch(() => { if (current) setVerified(null); });
    return () => { current = false; };
  }, [target.path, resolve]);
  return verified?.path === target.path && verified.resolve === resolve
    ? <WorkspaceFileLink {...target} onOpen={onOpen}>{children}</WorkspaceFileLink>
    : <>{children}</>;
}
