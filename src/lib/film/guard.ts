import { notFound } from "next/navigation";

/**
 * Local film-capture gate. Never enabled in production deploys.
 * Does not alter authorization on customer, Guide, or Management routes.
 */
export function assertFilmCapture() {
  if (process.env.STUDY_HALL_FILM !== "1") notFound();
  if (process.env.NODE_ENV === "production" && process.env.STUDY_HALL_FILM_ALLOW_PROD !== "1") {
    notFound();
  }
}
