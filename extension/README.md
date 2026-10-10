# Sierra Call Bridge

This custom Chrome extension keeps regular ChatGPT web Voice. It uses CloudTalk's embedded **web phone** for call events and your existing BlackHole devices for audio. It does not use the OpenAI Realtime API, automatically dial, scrape a desktop app, or install a new paid service.

## Install on your Mac

1. Unzip `Sierra-Call-Bridge.zip`. Keep the extracted `Sierra-Call-Bridge` folder.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select that folder (the one containing `manifest.json`). Review Chrome's access prompt for ChatGPT and your private CloudTalk Control site.
3. Refresh your existing Sierra GPT chat and your signed-in [CloudTalk Control](https://cloudtalk-control.zzoey9979.chatgpt.site) tab. Start GPT Voice with its text composer visible. Its connection must finish loading. Keep your existing Sierra conversation instructions/skill.
4. Click the extension icon to open its phone/control page. Select the GPT conversation and CloudTalk Control tab. If you want automatic marking, check that option and load/select existing outcome tags. Unmapped outcomes save notes only. Click **Connect bridge**.
5. Sign in to the embedded CloudTalk phone if asked, allow its microphone, and choose the audio devices below. Make calls from this embedded phone so its events reach the bridge. Calls made in the desktop app or a separate phone tab cannot be detected here.

No API key, bridge token, password, or extension-store purchase is needed. A signed-in private Site tab is required for authenticated writes; it must stay open. GPT text context delivery requires no plugin selection. The extension routes bounded outcomes to the deployed bridge itself.

## Audio

- CloudTalk web phone speaker: **BlackHole 2ch**.
- CloudTalk web phone microphone: **BlackHole 16ch**.
- Chrome/GPT microphone: **BlackHole 2ch**.
- Mac/Chrome output for GPT: **BlackHole 16ch**.

Restart Voice after changing audio devices. Your earlier desktop settings do not prove the embedded web phone has selected the same devices. GPT tab output is muted when connected, while dialing and after hang-up; only an acknowledged answered-call context unmutes it. Stop restores its prior mute state. The extension cannot change macOS devices or Chrome's microphone selection.

## What runs automatically

Documented CloudTalk dialing/answer/contact/end events update the verified number, contact name/company and call UUID. Context enters the exact selected GPT conversation. On call end, GPT is asked for bounded JSON outcome fields; with automatic marking enabled, the extension saves one contact note and its preselected existing tag through your authenticated bridge. It uses the contact ID and exact phone number from that call, never a guessed lead.

The writes are **contact notes/tags**, not call dispositions. A `do_not_call` tag does not itself prevent another call; the operator must enforce suppression in the dialing workflow. The extension cannot verify booking, SMS delivery, or whether a website was built. It tells GPT to avoid claiming those without evidence.

## First real test

Use your own test number only; no customer test call is authorized by this package. First leave automatic marking off. Confirm the number/name changes when you dial, the phase becomes `calling` on answer, caller audio reaches GPT, GPT audio reaches the phone, and GPT is muted when you hang up. Then verify a test contact and explicitly enable marking for a test note/tag. Inspect the real CloudTalk contact afterward. Don't infer a successful write from GPT's words; use the extension's save result and CloudTalk readback.

## Clear failure states

- Human GPT draft present: it is preserved. Send or clear it yourself.
- Send blocked before submission: bounded retries run while the control tab stays open; a manual retry is also available.
- Submission attempted without transcript acknowledgment: no resend. Check GPT, then stop/reconnect.
- Overlapping calls, mismatched contact/number or changed GPT chat: audio mutes and the bridge reports an error.
- Missing contact ID or international number: marking is blocked.
- Unknown note/tag write result: no retry. Check CloudTalk before any manual action. Partial saves show the note result separately.
- GPT does not produce the requested JSON: the page shows `Awaiting GPT outcome`; it does not fabricate an outcome.
- Phone frame fails or microphone/login is denied: call detection/audio is unavailable. No alternate credentials or security bypass are attempted.

## Verification completed here

Node tests cover lifecycle, duplicate events, overlapping calls, exact chat binding, wrong outcome association, full mocked event-to-GPT-to-write flow, immediate hang-up muting, uncertain writes, human-draft preservation and missing transcript acknowledgment. Private server tests cover authenticated requests, cross-site rejection, existing tags, note/tag sequencing and partial failures. Browser inspection verified this GPT version's composer, Send button, user-message acknowledgment and assistant JSON-code containers; a harmless text test received READY.

**Not verified yet:** extension installation/loading in a real Chrome profile, CloudTalk frame/login/events, GPT Voice connection, BlackHole audio, real contact writes, timing between consecutive live calls. Cloud Voice remained loading in the available browser; there is no remote access to your Mac. This is a complete implementation packaged for local testing, not proof of a functioning unattended live caller.

## Security and source

Only ChatGPT and the exact private CloudTalk Control site have extension host access. CloudTalk events require the documented origin plus the exact embedded frame. Calls/outcomes remain in Chrome session storage and are cleared on Stop/browser restart; no full transcript, cookies, tokens or audio is collected. Credentials remain in the existing server environment. No remote scripts, telemetry, arbitrary URLs or generic API execution.

`SPEC.md` records requirements and acceptance criteria. Implementation uses the installed incremental-implementation workflow associated with [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills), and the specification-first approach described by [github/spec-kit](https://github.com/github/spec-kit). No source was copied from those repositories. Browser logic is newly written against official [Chrome content-script APIs](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) and [CloudTalk iframe events](https://help.cloudtalk.io/en/articles/11791061-embedding-cloudtalk-phone-in-a-web-application). No runtime dependencies were added. Tests use Node's built-in runner: `npm test`.
