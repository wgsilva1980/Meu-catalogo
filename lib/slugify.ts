const DIACRITICS = /[̀-ͯ]/g

export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
