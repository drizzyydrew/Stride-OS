import { createDeletionWorkerHandler } from '../_shared/deletionHandlers.ts';
import { consumeDeletionTicket, scheduleDeletionRequest } from '../_shared/deletionRuntime.ts';

// Authenticate only a single-use, expiring ticket bound to this request/purpose.
Deno.serve(createDeletionWorkerHandler({ consume: consumeDeletionTicket, schedule: scheduleDeletionRequest }));
