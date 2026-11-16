# Weight picker caption follow-up

The owner accepts build116's new layouts and six-active-minute recording/offline
save, requesting only removal of the visible Hundreds/Tens/Ones captions above
the weight wheels. Feet/Inches and metric height labels remain visible.

The existing Wheel accepts an optional showLabel flag, true by default. Only the
three weight wheels pass false. Wheel values, callbacks, storage, unit conversion,
Save/Cancel and accessible labels are unchanged. This source patch is after the
immutable build116 upload and is not present in installed116. Billing testing can
use116; include this cosmetic correction in the next candidate.

The existing three actual measurement JSX interaction checks pass: precise-value
and provenance preservation on open/cancel/unit switch; wheel selection and failed
Save retry; and birth-date cursor/explicit selection. No new mirror test was added
for the caption conditional. Diff check and the canonical npm run typecheck (TypeScript5.9.3 with
tsconfig.typecheck.json) pass. An initial generic tsc invocation used the broad
base configuration and reported excluded fixture/Deno/generated-route errors;
that invocation is not the project gate. No unrelated source/configuration was
changed to suppress them. The previous1,924-test result belongs to built116.

Subscription preparation: the owner supplied the usual app email. Exact Auth
owner verification is pending connection timeouts in the MCP SQL route and the
CLI Management API login-role initialization. No temporary QA owner was bound,
no global billing flag changed, and no purchase, account or training-data action
was taken. The next device action is plan loading and capture on116, followed by
the controlled purchase/server lifecycle once the verified owner setup is ready.
