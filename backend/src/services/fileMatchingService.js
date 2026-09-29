// src/services/fileMatchingService.js
// Matches media_bucket files to TVs based on display_number appearing in filename
// e.g. filename "DISP-001-promo.mp4" matches TV with display_number "DISP-001"

/**
 * @param {Array} files       - rows from media_bucket
 * @param {Array} tvs         - rows from displays (id, display_number)
 * @returns {Array}           - [{ tv, files: [...] }, ...]
 */
export const matchFilesToTvs = (files, tvs) =>
  tvs.map((tv) => ({
    tv,
    files: files.filter((f) =>
      f.file_name.includes(tv.display_number) || f.file_path.includes(tv.display_number)
    ),
  }));

/**
 * Fallback: if no TV-specific files found, distribute all files to all TVs
 */
export const matchFilesToTvsWithFallback = (files, tvs) => {
  const strict = matchFilesToTvs(files, tvs);
  const anyMatched = strict.some((pair) => pair.files.length > 0);
  if (anyMatched) return strict;
  // Fallback: give all files to every TV
  return tvs.map((tv) => ({ tv, files }));
};
