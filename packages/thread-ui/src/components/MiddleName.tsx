/** Keep the filename extension visible in narrow scientific file trees. */
export function MiddleName({name}: {name: string}) {
  const split = Math.max(1, name.length - Math.min(12, Math.ceil(name.length / 2)));
  return <span className="workbench-middle-name" title={name}><span>{name.slice(0, split)}</span><span>{name.slice(split)}</span></span>;
}
