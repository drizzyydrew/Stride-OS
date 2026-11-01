import { createDeletionReceiptHandler } from '../_shared/deletionHandlers.ts';
import { deletionDependencies } from '../_shared/deletionRuntime.ts';

// Gateway authentication is replaced by the hashed, private 256-bit receipt.
Deno.serve(createDeletionReceiptHandler(deletionDependencies));
