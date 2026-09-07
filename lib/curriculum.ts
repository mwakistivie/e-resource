/**
 * Canonical grade/subject/term vocabulary, shared by the admin form and the
 * public homepage filters. Having ONE list both sides draw from is what
 * fixes the filter-fragmentation bug: before this, subject/gradeLevel were
 * free-text inputs, so "Creative Arts" / "CREATIVE ARTS" / "creative arts"
 * all became separate, non-matching filter values. Now the admin can only
 * pick from this list, so every new resource is consistent by construction.
 *
 * Existing resources created before this change may still have inconsistent
 * casing — the homepage filter query matches case-insensitively (see
 * app/page.tsx) specifically to paper over that legacy data without
 * requiring a backfill, but editing old resources in the admin dashboard to
 * pick from this list is worth doing when you have a moment.
 */

export const GRADE_LEVELS = [
  "PP1",
  "PP2",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Form 1",
  "Form 2",
  "Form 3",
  "Form 4",
] as const;

export const SUBJECTS = [
  "Mathematics",
  "English",
  "Kiswahili",
  "Science and Technology",
  "Integrated Science",
  "Biology",
  "Chemistry",
  "Physics",
  "Agriculture",
  "Social Studies",
  "History and Government",
  "Geography",
  "Christian Religious Education",
  "Islamic Religious Education",
  "Hindu Religious Education",
  "Business Studies",
  "Computer Science",
  "Home Science",
  "Pre-Technical Studies",
  "Creative Arts",
  "Creative Arts and Sports",
  "Physical Education",
  "Music",
  "Art and Design",
  "French",
  "German",
  "Arabic",
  "Other",
] as const;

export const TERMS = ["Term 1", "Term 2", "Term 3"] as const;
