# Problem Navigator Verification Checklist

- [ ] Brand OS CI passes on exact head.
- [ ] Existing V2 + Brand Engine Chromium smoke passes.
- [ ] Problem Navigator desktop Chromium smoke passes without state mutation.
- [ ] Problem Navigator mobile 390×844 smoke passes with drawer fully closed and no horizontal overflow.
- [ ] Exact Vercel preview is READY.
- [ ] Preview build logs are clean.
- [ ] Preview error/fatal runtime logs are clean.
- [ ] `/api/health` remains healthy on preview.
- [ ] Branch remains based on the intended V3 release head until PR #21 lands.
- [ ] PR remains draft and is not merged while PR #21 is unmerged.
