import { describe, expect, it } from 'vitest';
import { codeLanguage, downloadOnlyReason, isBinaryPreview, isDownloadOnlyPath } from './filePreviewPolicy';

describe('download-only previews', () => {
  it('recognizes archives and other unsupported formats without blocking renderers or source', () => {
    for (const path of ['bundle.ZIP', '/tmp/a.tar.gz', 'report.docx', 'data.sqlite', 'video.mp4']) {
      expect(isDownloadOnlyPath(path), path).toBe(true);
      expect(downloadOnlyReason(path), path).toBeNull();
    }
    for (const path of ['README', 'x.md', 'x.ts', 'x.png', 'x.pdf', 'x.pdb', 'custom.config']) {
      expect(isDownloadOnlyPath(path), path).toBe(false);
    }
  });
  it('catches unknown binary data while preserving text and an occasional replacement character', () => {
    expect(isBinaryPreview('PK\0abc')).toBe(true);
    expect(isBinaryPreview('ab\u0001\u0002\ufffdcd')).toBe(true);
    expect(isBinaryPreview('hello\n中文\tworld \ufffd')).toBe(false);
    expect(isBinaryPreview('')).toBe(false);
  });
});

// B28: ORCA and PySCF outputs from orca_pyscf_file_formats (2026-10-22 table).
describe('ORCA and PySCF formats', () => {
  it('offers binary orbital, density and checkpoint files as downloads with a reason', () => {
    for (const path of ['run/job.gbw', 'job.densities', 'job.mp2nat', 'job.uno', 'job.qro', 'job.uco', 'scf.chk', 'props.bson', 'props.ubjson', 'props.msgpack']) {
      expect(isDownloadOnlyPath(path), path).toBe(true);
      expect(downloadOnlyReason(path), path).toBe('scientificBinaryFile');
    }
  });
  it('previews the text formats, including volumetric cube grids and ESD spectra', () => {
    for (const path of ['job.inp', 'job.out', 'job.log', 'job.hess', 'job.mkl', 'job.molden', 'job.molden.input', 'orb.cube', 'orb.cub', 'job.property.txt', 'job.property.json', 'job.spectrum', 'job.spectrum.root1', 'FCIDUMP', 'h2.fcidump', 'traj_trj.xyz']) {
      expect(isDownloadOnlyPath(path), path).toBe(false);
    }
  });
  it('leaves formats of unconfirmed encoding to content detection', () => {
    for (const path of ['job.carthess', 'job.opt', 'job.plt', 'tmpcheckpoint']) {
      expect(isDownloadOnlyPath(path), path).toBe(false);
    }
    expect(isBinaryPreview('     2\n comment\nO 0 0 0\nH 0 0 1\n')).toBe(false);
  });
  it('detects an HDF5 checkpoint without an extension from its signature', () => {
    // 0x89 'HDF' CR LF 0x1a LF, decoded lossily as UTF-8 by the text endpoint.
    expect(isBinaryPreview('\ufffdHDF\r\n\u001a\nsuperblock')).toBe(true);
  });
});

describe('code languages', () => {
  it('maps reported extensions to editor language ids', () => {
    expect(codeLanguage('py')).toBe('python');
    expect(codeLanguage('PY')).toBe('python');
    expect(codeLanguage('md')).toBe('markdown');
    expect(codeLanguage('sh')).toBe('shell');
    expect(codeLanguage('tsx')).toBe('typescript');
    expect(codeLanguage('text')).toBe('plaintext');
    expect(codeLanguage('')).toBe('plaintext');
    expect(codeLanguage('python')).toBe('python');
    expect(codeLanguage('out')).toBe('out');
  });
});
