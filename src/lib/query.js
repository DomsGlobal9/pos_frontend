import { useQuery as useQueryRQ, useInfiniteQuery as useInfiniteQueryRQ } from '@tanstack/react-query'

/*
 * A QUESTION WAITING FOR THE INTERNET IS STILL "LOADING" (17 Nov).
 *
 * With the internet off, the query library does not ask the server and fail: it PAUSES, and reports
 * neither loading nor an error. Every screen was written "if loading, say so; if it failed, say why;
 * otherwise show the answer" -- so offline, with nothing fetched before, they went on to show an
 * answer that was not there. Ten of them crashed outright into a raw "Unexpected Application Error"
 * (Shift, Items, Devices, Inventory link, and every bill, return, customer and order opened on its
 * own); the lists said "No bills yet" and "No customers yet", which is worse than a crash because it
 * is believable.
 *
 * So the screens ask through here. A question that is paused with no answer yet counts as loading;
 * the screen shows its own "Loading..." line under a header that already says "No connection. Sales
 * are kept on this till.", and fills in by itself the moment the line is back. An answer already on
 * the device is still shown as it was -- that part of pausing is right and is kept.
 */
const stillWaiting = q => (q.isPaused && q.data === undefined && !q.isError ? { ...q, isLoading: true, waitingForInternet: true } : q)

export const useQuery = (...args) => stillWaiting(useQueryRQ(...args))
export const useInfiniteQuery = (...args) => stillWaiting(useInfiniteQueryRQ(...args))
