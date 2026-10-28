// Sort alphabetically by last name (the last word of the name), then full name
function lastNameOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export function compareByLastName(a: { name: string }, b: { name: string }): number {
  return (
    lastNameOf(a.name).localeCompare(lastNameOf(b.name), undefined, { sensitivity: "base" }) ||
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}
