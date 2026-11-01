import { createDeletionAccountHandler } from '../_shared/deletionHandlers.ts';
import { deletionDependencies } from '../_shared/deletionRuntime.ts';

Deno.serve(createDeletionAccountHandler(deletionDependencies));
