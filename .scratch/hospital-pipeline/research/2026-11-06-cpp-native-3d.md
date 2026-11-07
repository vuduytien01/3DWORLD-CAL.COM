# C++/native 3D engine options for the hospital visualization (research note, 2026-11-06)

Serves the cal.diy hospital capstone: a 2-person TS/JS team building a Next.js booking + exam-pipeline system in Docker, evaluating a later 3D hospital visualization. This note covers the C++/native-engine track. Companion note: `2026-11-06-tsjs-web-3d.md` (TS/JS track).

Claim labels used throughout: **[official-doc]** (vendor docs, license pages, or engine source), **[measured]** (third-party benchmark with named hardware/workload), **[community-reported]** (forum posts, vendor pricing pages, secondary sources), **[inferred]** (our reasoning from evidence), **[guess]** (unverified).

## Executive answer (10 lines)

1. Unreal Engine 5 is the only C++-rooted option with AAA rendering (Nanite/Lumen). It has **no WebAssembly export at all** since UE 4.24 [official-doc]; browser access is only Pixel Streaming: render on a GPU server, ship WebRTC video.
2. UE5 licensing is effectively free for this team: free under $1M company revenue, 5% royalty only after $1M lifetime revenue per product [official-doc].
3. Pixel Streaming in Docker is real but heavy: official Linux runtime images (beta support), NVIDIA GPU with NVENC plus NVIDIA Container Toolkit mandatory on Linux, host networking recommended, one GPU render instance per concurrent user [official-doc].
4. Pixel Streaming cost is roughly $0.5 to $1.2 per stream-hour on AWS G4/G5 class instances, plus egress; managed services start near $29/month for a small plan [community-reported].
5. Unity (C# scripting on a C++ engine) is the friendliest C++-rooted path: free under $200k revenue, WebGPU left experimental in Unity 6.6 (mid 2026), WebGL2 remains the default web backend [official-doc].
6. Godot 4 is MIT-licensed and light, but mainline web export is WebGL2 with the Compatibility renderer only, single-threaded by default; WebGPU exists only in a community fork as of late 2026 [official-doc + community-reported].
7. Custom C++ with OpenGL/Vulkan compiled to WebAssembly via Emscripten + emdawnwebgpu is a production-proven path (Figma ships it) but the steepest learning curve for two TS students.
8. WebAssembly CPU overhead vs native is roughly 1.2x to 2x for straight-line compute [measured]; for 3D scenes the bottleneck is usually the browser GPU API, not WASM.
9. O3DE (Apache 2.0) has no web export, only an experimental WebGPU RHI effort; OpenSceneGraph is in maintenance mode; Qt 3D is deprecated in Qt 6.8. None fit.
10. Hard constraint summary: if the 3D view must live inside their Next.js app served from plain Docker, WASM-based delivery (Godot, Unity web, or custom C++) fits; UE5's browser story forces a GPU-per-user streaming fleet they cannot afford to operate casually [inferred].

## Tech-by-tech comparison

| Engine | Language | Delivery to user | Perf envelope (cited) | License + cost | Docker story | Learning curve for 2 TS/JS students |
|---|---|---|---|---|---|---|
| Unreal Engine 5.8 (June 2026) | C++ (Blueprints optional) | Native exe; web only via Pixel Streaming (WebRTC video). No WASM export since UE 4.24 [official-doc] | City Sample: ~44 fps avg at native 720p on i9-10900K + RTX 3090, CPU-bound [measured, Digital Foundry 2022]. Avowed (UE5, 2025): 1080p Epic needs ~RTX 3080 class for 60 fps; 4K native no GPU holds 60 [measured, DSOGaming]. UE 5.8 Lumen Lite: Epic claims 2x faster than Lumen HQ, 60 fps target on Switch 2 [official claim, no independent number] | Free under $1M company revenue; 5% royalty after $1M lifetime per product; $1,850/seat/yr only for non-game companies >$1M [official-doc] | Official Linux runtime container image `ghcr.io/epicgames/unreal-engine:runtime-pixel-streaming`; containers are Beta; NVIDIA GPU + Container Toolkit required on Linux; host networking recommended [official-doc] | Steep: C++ or Blueprints, huge editor, Linux packaging toolchain. Weeks-to-months to first decent scene [inferred] |
| Unity 6.x (6.6 = 6000.6, mid 2026) | C# on C++ engine core | Web export (WASM + WebGL2 default; WebGPU supported, opt-in). Native builds optional | WebGL2 path is the mature default; WebGPU enables compute shaders, GPU Resident Drawing, STP upscaler in browser [official-doc]. No credible independent web-vs-native FPS delta found in this run [gap noted] | Personal free (<= $200k revenue/funding trailing 12 mo); Pro from ~$2,310/yr >$200k; Enterprise >$25M; free Student plan for enrolled students [official-doc] | Web builds are static files; deploy behind Next.js/nginx in plain Docker with no GPU server-side [inferred from delivery model]. Editor runs on student laptops | Low-to-moderate: C# is close to TS; huge tutorial corpus [inferred] |
| Godot 4.x (4.6 stable, 2026) | C++ core; GDScript / C# | Web export WASM + WebGL2 (Compatibility renderer only in mainline). Single-threaded default since 4.3; WASM SIMD default since 4.5. WebGPU only via community fork `godotwebgpu` (4.6.2, beta May 2026) [official-doc + community-reported] | 4.3 web build ~40 MB uncompressed / ~5 MB Brotli [official claim]. WASM SIMD default from 4.5 dev5 with official "serious performance boost" claim (no number captured) [official claim]. Compatibility renderer targets mid-tier mobile-class visuals [official-doc] | MIT, zero cost [official-doc] | Web builds are static files; trivially served from their existing Docker/Next.js stack; no GPU host needed [inferred] | Low: MIT, small engine, GDScript reads like Python; C# cannot export to web in Godot 4 [official-doc] |
| Custom C++ + OpenGL/Vulkan -> Emscripten WASM (+ emdawnwebgpu) | C++ | Browser WASM; same C++ can also build native | WASM vs native: 1.25x-1.76x on server workloads (Wasmtime 19) [measured, Tremhost 2025]; >50% of 51 benchmarks within 2x of native [measured, CCGrid 2024]; best managed-language backends ~1.4x [measured, MPLR 2025]; WASM SIMD (128-bit) ~4x slower than AVX2 at large payloads [measured, nickb.dev 2024]. Figma runs a C++ renderer via Emscripten + WebGPU in production [official company blog, Sept 2025] | Emscripten/LLVM free (MIT/NCSA-style); emdawnwebgpu maintained by Dawn/Google, `--use-port=emdawnwebgpu`, bundled since Emscripten 4.0.10; old `-sUSE_WEBGPU` deprecated May 2025 and removed Sept 2025 [official-doc] | WebAssembly output is static files; compiles in CI containers (emsdk image); runtime needs no server GPU [inferred] | Steepest: C++ build systems, graphics API fundamentals, async WebGPU, JS interop. Months for a nontrivial interactive scene [inferred] |
| O3DE 25.05 | C++ | Native only. No web export; WebGPU RHI is an open epic (June 2025) with a `webgpu-rhi` branch; roadmap item "first version of WebGPU Atom" targeted Nov 2025, no shipped web path found [official repo + community-reported] | n/a for web | Apache 2.0 (MIT option per LICENSE.txt) [official-doc] | n/a for web; heavy native build | Not viable for browser delivery [inferred] |
| OpenSceneGraph | C++/OpenGL | Native only; no web story | n/a | LGPL-style (OSGPL) | n/a | Maintenance mode since ~2018, last release 3.6.5 (Jan 2020); successor is VulkanSceneGraph [community-reported]. Do not start new work here [inferred] |
| Qt 3D | C++ | Native only | n/a | LGPL/commercial | n/a | Deprecated in Qt 6.8 ("strongly advise against using it in new code") [official-doc]; removed from release configuration in dev branch (March 2024) [official mailing list]. Not recommended |

## Unreal Engine 5: performance, license, web delivery

**Rendering performance.** The honest envelope for Nanite/Lumen is "high-end desktop GPU for Epic settings." Digital Foundry's UE5 launch analysis (April 2022) measured the City Sample at ~44 fps average at native 720p on an i9-10900K at 5 GHz + RTX 3090, explicitly CPU-bound, with hardware Lumen costing a measured 32% in one test and 7% on NVIDIA GPUs when using TSR [measured]. DSOGaming's Avowed analysis (Feb 2025) measured 1080p Epic settings needing ~RTX 3080 / RX 6900 XT for a smooth 60+ fps, 1440p needing RX 7900 XTX / RTX 5080, and no GPU holding 60 fps at native 4K Epic; hardware Lumen cost a measured 5-7 fps even on an RTX 5090 [measured]. A Scans Factory tech demo dropped from 120+ fps to 40-50 fps at 1080p on an RTX 4080 when Lumen+Nanite were enabled, with the caveat that the demo is unoptimized [community-reported]. Epic's own UE 5.8 claim (June 2026): Lumen Lite is "twice as fast as Lumen High Quality" and targets 60 fps on Switch 2 [official claim, not independently verified]. For a hospital interior walkthrough the workload is far lighter than a AAA city, so mid-range GPUs would be fine; that is inference, not a measured hospital-scene number [inferred].

**Licensing (as of 2026).** Free to use for students, educators, hobbyists, and companies under $1M annual gross revenue [official-doc, unrealengine.com FAQ]. For products distributed to end users: 5% royalty on worldwide gross revenue above the first $1M lifetime per product, with a $10k/quarter exclusion; 3.5% if shipping day-one on Epic Games Store (irrelevant here) [official-doc, EULA]. Seat subscriptions ($1,850/seat/yr) apply only to non-runtime-distribution use by companies over $1M revenue [official-doc]. A student capstone pays nothing [inferred from the above].

**Web delivery.** UE5 has no HTML5/WebAssembly export. Epic migrated HTML5 out of the engine at UE 4.24; the community maintained forks through 4.27, and UE5 ships no web target [official-doc statement via Epic docs/forums; community history pages corroborate]. The official browser path is Pixel Streaming: the packaged app renders offscreen on a server, encodes frames (H.264 via NVENC ~8.97 ms per 1080p frame, VP8/VP9 on CPU, AV1 on Ada+ GPUs), and streams over WebRTC with a signaling server serving the player page [official-doc, Pixel Streaming Reference]. One GPU encoding session per peer, up to the GPU's NVENC session limit [official-doc]. Pixel Streaming 2 shipped with UE 5.5 and both plugins coexist [official-doc]. UE 5.8 (June 23, 2026) is the last planned UE5 major release as Epic ramps UE6 [official-doc].

## Unity: performance, license, web delivery

**Licensing.** The Runtime Fee was cancelled September 12, 2024 [official-doc, unity.com blog]. Current tiers: Personal free for revenue/funding up to $200k trailing-12-months; Pro (from $2,310/yr per seat, listed on unity.com/products in 2026) required above $200k; Enterprise required above $25M [official-doc]. Students enrolled in an accredited institution qualify for the free Unity Student plan (threshold $1M), which matters for a capstone [official-doc]. No royalties on distributed runtimes for Unity 6 or earlier versions [official-doc, Software Additional Terms].

**Web delivery.** WebGL2 remains the default web backend and is the mature path [official-doc]. WebGPU was experimental in Unity 6.1 (Dec 2024) and, per Unity staff announcement, left experimental in Unity 6000.6 (announced Aug 2026): it is a supported backend but not the default; enabling it unlocks compute shaders, GPU Resident Drawing, GPU occlusion culling, STP upscaling, VFX Graph, and compute skinning in the browser, with automatic fallback to WebGL2 [community-reported (official Unity forum staff post)]. Browser-side WebGPU is now supported in all major engines: Chrome/Edge 113+ (Windows/macOS/ChromeOS), Firefox 141+ on Windows and 145 on macOS Tahoe, Safari 26 on macOS Tahoe/iOS 26 [official-doc, web.dev Nov 2025]. No credible independent benchmark of Unity WebGPU vs native was found in this run; treat "close to native" claims from marketing as unverified [gap, guess].

## Godot 4: performance, license, web delivery

**License.** MIT, zero cost, no royalties [official-doc, godotengine.org / docs].

**Web delivery (mainline 4.x, current stable 4.6).** Web export targets WebAssembly + WebGL 2.0 with the Compatibility renderer; Forward+ and Mobile renderers do not run on web in mainline because they are built on Vulkan-class APIs and "Godot currently does not support WebGPU" [official-doc, docs.godotengine.org 4.6]. Threading: since 4.3 the default export is single-threaded, avoiding SharedArrayBuffer and cross-origin isolation entirely; the threaded export performs better but requires COOP/COEP headers (which blocks third-party embeds/ads on the host page) [official-doc]. Apple device web playback issues mostly disappear on single-threaded builds [official-doc, 4.3 progress report]. Payload: the 4.3 web .wasm was ~40 MB uncompressed / ~5 MB Brotli [official claim]. WASM SIMD became the default in 4.5 dev5 (June 2025) with an official "serious performance boost" announcement [official claim; the linked benchmark numbers were not captured in this run]. wasm64 is planned for 4.7 [community-reported]. C# (Godot 4) cannot export to web at all, so a web project means GDScript [official-doc].

**WebGPU status.** A community fork, `dwalter/godotwebgpu` (fork of 4.6.2, public beta May 10, 2026), implements a WebGPU RenderingDeviceDriver via Emscripten's emdawnwebgpu, supporting the Mobile renderer and compute shaders on desktop Chrome/Firefox/Safari, Windows/Linux still TODO; upstream merge is hoped for 4.9/4.10 and is not mainline [community-reported, project FAQ + GitHub]. A second, human-built implementation (davnotdev) plans a draft PR. Conclusion: WebGPU-in-Godot is not something a capstone can depend on in the mainline today [inferred].

## Custom C++ via Emscripten: is it realistic for two TS/JS students?

**Toolchain maturity.** Emscripten is actively maintained (docs current at 4.x/7.0-dev in 2026). WebGPU access from C++ goes through **emdawnwebgpu**, Dawn's maintained implementation of the standardized `webgpu.h` for Emscripten; it replaced the unmaintained built-in bindings: deprecated May 2025 (PR #24220) and removed around September 2025 (issue #24265 closed); usage is `emcc --use-port=emdawnwebgpu`, with a bundled snapshot since Emscripten 4.0.10 [official-doc, emscripten.org + Dawn docs + GitHub].

**Proof it works at scale.** Figma rewrote its renderer to WebGPU (production, Sept 2025): the C++ renderer is compiled to WASM with Emscripten for the browser and to native with Dawn for server rendering, with a dynamic WebGPU-to-WebGL fallback; they note WebGPU's async readback forced real architectural changes and they saw performance improvements on some device classes with no regressions [official company blog, measured internally by Figma but not published as numbers].

**Performance.** WASM is not the bottleneck people fear, but it is not free: on server-side WASI runtimes, overhead measured 1.25x (SHA-256) to 1.76x (Fannkuch) vs native on Wasmtime 19 [measured, Tremhost Labs July 2025]; across 51 C/C++ benchmarks on Wasmtime, more than half ran within 2x of native on JIT [measured, CCGrid 2024]; the best managed-language WASM backends average ~1.4x slower than native [measured, MPLR 2025]; WASM SIMD's 128-bit registers lose to AVX2 by up to ~4x on wide data paths [measured, nickb.dev 2024]. Browser engines (V8 Liftoff/TurboFan) are generally in the same 1x-2x band for straight-line compute; numbers for in-browser 3D scenes are workload-specific and not reliably published [inferred]. In practice the frame budget of a hospital walkthrough is dominated by GPU draws and shader cost, so the WASM tax is secondary [inferred].

**Realism for the team.** They would need: CMake or similar, emsdk, a scene-graph decision (write one or adopt something small), input/camera code, asset loading (glTF), WebGPU via emdawnwebgpu, and JS interop to drive it from Next.js. Two motivated students could reach a static "fly through the hospital" scene in weeks and a genuinely interactive one in months, but every hour spent on engine plumbing is an hour not spent on the booking system [inferred]. This path makes sense only if the 3D part is the capstone's differentiator.

## Pixel Streaming in Docker: what it actually requires

**How it works.** A packaged UE app runs on a GPU machine with the Pixel Streaming plugin, renders offscreen (`-RenderOffscreen`), hardware-encodes each frame, and sends it as WebRTC media to a browser; a Node-based signaling server hands out SDP and serves the HTML/JS player. Input (mouse/keyboard/touch/gamepad) flows back over data channels [official-doc].

**Hardware and OS requirements (official).** The streaming machine needs an NVIDIA GPU supporting NVENC, an AMD GPU supporting AMF, or Mac VideoToolbox [official-doc, Pixel Streaming Reference]. The plugin supports Windows, Linux, and Mac; the signaling server is tested on Ubuntu 18.04/20.04/22.04/24.04 [official-doc]. A CoTURN STUN/TURN server is the production-grade NAT-traversal reference [official-doc, Hosting and Networking Guide].

**Docker specifics.** Epic provides official container images with container support labeled **Beta** [official-doc, "Known Limitations of Containers in Unreal Engine"]:
- Linux runtime image: `ghcr.io/epicgames/unreal-engine:runtime-pixel-streaming`, extending a CUDA/NVENC-enabled base. On Linux, **only NVIDIA GPUs** are supported in containers (AMD planned) [official-doc].
- The NVIDIA Container Toolkit (nvidia-docker) is required; the host needs NVIDIA drivers [official-doc, unrealcontainers.com].
- Host networking mode is strongly recommended: container network stacks add UDP latency that degrades WebRTC responsiveness; Windows containers cannot use host networking and always suffer added latency [community-reported, unrealcontainers.com].
- A minimal deployment is two containers: the streaming app container plus the Cirrus signaling-server container (official image `ghcr.io/epicgames/pixel-streaming-signalling-server`) [community-reported with official image reference].
- Practical pitfall: a forum report of UE 5.4 on Linux failing against NVIDIA driver 550.54+ due to Vulkan version mismatches; driver/引擎 version pinning matters [community-reported].
- Linux container packaging means building/packaging the project for Linux (from a Linux toolchain or cross-compile), a nontrivial workflow addition [inferred].

**Concurrency and cost.** Epic's own scaling guidance: provision a new engine instance per connected user for separate sessions [official-doc, per community guide quoting Epic; matchmaker was deprecated in 5.5]. So cost is one GPU instance per concurrent stream:
- AWS G4dn.xlarge (T4): roughly $0.50-0.60/hour; G5.xlarge (A10): roughly $1.00-1.20/hour; egress ~$0.05-0.09/GB [community-reported, secondary estimates; check current AWS pricing].
- Reddit practitioner math lands near $0.30-0.67 per stream-hour on smaller instances [community-reported].
- Managed Pixel Streaming services: Eagle 3D Streaming core plan $29/month for 300 minutes and up to 10 concurrent streams [community-reported, vendor pricing page]. StraySpark (2026) summarizes the market at "$0.50-1.00/hour per concurrent user" [community-reported].
- Encoder capacity per GPU is bounded: one NVENC encode session per peer (H.264 ~8.97 ms/1080p frame) [official-doc]; NVENC consumer-GPU session caps historically limited multi-stream density [inferred; not re-verified this run].

For a capstone demo with 1-3 simultaneous viewers, a single G5-class instance (or a $29 managed plan) suffices; for anything public-facing, per-stream cost scales linearly and a GPU fleet becomes the biggest line item [inferred].

## What limits each number (benchmark provenance)

- **Digital Foundry City Sample (Apr 2022, measured).** Hardware: i9-10900K @ 5.0 GHz, RTX 3090/3080, RTX 2060 Super, Ryzen 5 3600. Workload: Epic's UE5 launch city demo at launch-era engine build. Limits: CPU-bound at 720p native; shader-compilation stutters; hardware Lumen BVH build cost. It is a demo, not an optimized product, and 2022-2026 engine updates (5.3-5.8) improved CPU/GPU paths since.
- **DSOGaming Avowed (Feb 2025, measured).** Hardware: Ryzen 9 7950X3D, RTX 2080Ti-5090, RX 6900XT-7900XTX, listed drivers. Workload: a shipped AAA game at Epic settings with Nanite+Lumen. Limits: Epic preset is the worst-case tier; the game scales down ~39% to High; conclusions say nothing about lightweight interior scenes.
- **wccftech Scans Factory demo (Jul 2024, community-reported).** RTX 4080, 1080p, unoptimized tech demo: the 120+ -> 40-50 fps delta shows feature cost, not product performance.
- **Tremhost Labs (Jul 2025, measured).** Wasmtime 19 (server WASI runtime, not the browser), Rust, AMD EPYC 4 vCPU. Workloads: SHA-256, Fannkuch-Redux, 4K image processing. Limits: standalone-runtime JIT, not V8; WASI I/O differs from browser; compute-bound only.
- **CCGrid 2024 cross-architecture study (measured).** Wasmtime/WAMR on x86-64/aarch64/riscv64/Jetson, 51 C/C++ benchmarks (WaBench), -O2 WASI SDK 20. Limits: server runtimes; startup measured separately; not browser rendering.
- **MPLR 2025 snapshot (measured).** Managed languages (Dart, Haskell, OCaml, Ruby, Scheme) on Wasm vs native. Limits: language runtimes, not hand-written C++; best-case ~1.4x is the relevant floor.
- **nickb.dev (2024, measured).** Node native module vs WASM; SIMD 128-bit vs AVX2 256-bit explains the large-payload gap. Limits: microbenchmark scope.
- **Godot numbers (official claims, not independently measured here).** 40 MB/5 MB payload (4.3 blog); WASM SIMD default in 4.5 (announcement links benchmarks we did not capture). Limits: claims from the engine team; the Compatibility/WebGL2 renderer is the real ceiling for mainline web 3D quality.
- **UE 5.8 Lumen Lite "2x faster" (official claim).** Epic's own framing, tied to a 60 fps target on Switch 2; no independent number found.
- **Pixel Streaming cost figures (community-reported).** AWS list prices fluctuate; secondary sites may lag; verify on the AWS calculator before budgeting.

## Fit for the two-person TS/JS capstone (synthesis)

- If the 3D view is a "see the hospital, find your room" layer inside the existing Next.js app: the C++-track options that fit their Docker deployment are Godot's WASM build or a custom C++/WASM module. Both ship as static files next to the web app, need no server GPU, and keep Docker trivial. Unity fits too if they accept C# [inferred].
- If the 3D view is the centerpiece (cinematic, photoreal hospital tour): UE5 via Pixel Streaming delivers the most impressive result but adds a GPU server per viewer, driver-version fragility, Linux packaging, and per-stream cost. For two students, that is a second infrastructure project [inferred].
- Given they are TS/JS-savvy and the 3D part is explicitly "for later," the pragmatic C++-rooted choice is Godot (MIT, GDScript, WASM web export, no license risk) with Unity as the alternative if they want C# and a bigger ecosystem; reserve UE5 for a demo-only streaming showcase if the visuals must wow [inferred].
- Anything written against WebGL2 in Godot/Unity today should plan for WebGPU later (all major browsers support it as of Nov 2025 [official-doc]), but neither engine's mainline web path is WebGPU-first yet [official-doc/community-reported].

## Sources

Unreal Engine:
- EULA and royalty terms: https://www.unrealengine.com/eula/unreal
- License options / FAQ: https://www.unrealengine.com/en-US/license ; https://www.unrealengine.com/en-US/faq
- EULA change log (3.5% Launch Everywhere, exclusions): https://www.unrealengine.com/eula-change-log/unreal
- Pixel Streaming Reference (GPUs, encoders, ports): https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-pixel-streaming-reference
- Pixel Streaming overview + Hosting/Networking Guide: https://dev.epicgames.com/documentation/en-us/unreal-engine/pixel-streaming-in-unreal-engine ; https://dev.epicgames.com/documentation/unreal-engine/hosting-and-networking-guide-for-pixel-streaming-in-unreal-engine
- Pixel Streaming 2 overview (UE 5.5+): https://dev.epicgames.com/documentation/unreal-engine/pixel-streaming-2-overview-in-unreal-engine
- Containers (Beta, Linux NVIDIA-only): https://dev.epicgames.com/documentation/unreal-engine/known-limitations-of-containers-in-unreal-engine
- Unreal Containers hub (official images, Pixel Streaming in Docker, host networking): https://unrealcontainers.com/docs/use-cases/pixel-streaming ; https://unrealcontainers.com/docs/obtaining-images/official-images
- UE 5.8 release announcement (Lumen Lite, last UE5 major): https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available ; https://www.unrealengine.com/news/state-of-unreal-2026-top-news-from-the-show
- HTML5 removal history (community corroboration): https://www.summerengine.com/make-great-games/unreal-engine-html5-export (see also Epic forums threads https://forums.unrealengine.com/t/ue5-export-to-html5/1625616 and https://forums.unrealengine.com/t/ue5-export-webgl/2039053)
- Linux Pixel Streaming driver pitfall (forum): https://forums.unrealengine.com/t/how-to-run-unreal-engine-app-with-pixel-streaming-using-ghcr-io-epicgames-unreal-engine-runtime-pixel-streaming-in-docker/1934433
- UE5 perf measurements: Digital Foundry https://www.digitalfoundry.net/articles/digitalfoundry-2022-unreal-engine-5-hands-on-the-cost-of-next-generation-rendering ; DSOGaming Avowed https://www.dsogaming.com/pc-performance-analyses/avowed-benchmarks-pc-performance-analysis/ ; wccftech https://wccftech.com/unreal-engine-5-annihilates-performance-1080p-rtx-4080/
- Pixel Streaming cost estimates: https://game-ace.com/blog/unreal-engine-pixel-streaming/ ; https://www.reddit.com/r/unrealengine/comments/t0m1lg/pixel_streaming_with_azure_cost/ ; https://www.strayspark.studio/blog/pixel-streaming-ue5-cloud-gaming-demo ; https://www.eagle3dstreaming.com/pricing ; https://aws.amazon.com/blogs/gametech/deploy-unreal-engines-pixel-streaming-at-scale-on-aws/

Unity:
- Runtime Fee cancellation: https://unity.com/blog/unity-is-canceling-the-runtime-fee ; terms update https://unity.com/blog/terms-update-runtime-fee-cancellation
- Current pricing/tiers: https://unity.com/products ; Additional Terms (thresholds, no runtime fee) https://github.com/Unity-Technologies/TermsOfService/blob/master/Unity%20Software%20Additional%20Terms.md
- WebGPU experimental in 6.1: https://discussions.unity.com/t/public-access-to-webgpu-experimental-in-unity-6-1/1572462
- WebGPU out of experimental in 6000.6: https://discussions.unity.com/t/webgpu-out-of-experimental-in-unity-6-6/1734694/1
- WebGPU docs/limitations: https://docs.unity.com/en-us/engine/6000.3/manual/platform-specific/webgl/develop/graphics/web-gpu ; https://docs.unity.com/en-us/engine/6000.5/manual/platform-specific/webgl/develop/graphics/web-gpu/limitations ; enable guide https://docs.unity.com/en-us/engine/7000.0/manual/platform-specific/webgl/develop/graphics/web-gpu/enable

Godot:
- Web export docs (WebGL2-only, single-threaded default, COOP/COEP, no C# web): https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html and https://docs.godotengine.org/en/4.6/tutorials/export/exporting_for_web.html
- 4.3 web export report (payload sizes, single-thread rationale): https://godotengine.org/article/progress-report-web-export-in-4-3/
- WASM SIMD default (4.5): https://forum.godotengine.org/t/upcoming-web-performance-boost/112866
- WebGPU proposal + community fork: https://github.com/godotengine/godot-proposals/issues/6646 ; https://godotwebgpu.com/ ; https://github.com/dwalter/godotwebgpu

Emscripten / WASM:
- WebGPU in Emscripten (emdawnwebgpu): https://emscripten.org/docs/porting/multimedia_and_graphics/WebGPU-support.html
- Dawn emdawnwebgpu package docs: https://dawn.googlesource.com/dawn/+/refs/heads/main/src/emdawnwebgpu/pkg/
- Deprecation of -sUSE_WEBGPU: https://github.com/emscripten-core/emscripten/pull/24220 ; https://github.com/emscripten-core/emscripten/issues/24265
- Chrome 138 Dawn/Emscripten note: https://developer.chrome.com/blog/new-in-webgpu-138
- Figma WebGPU production case: https://www.figma.com/blog/figma-rendering-powered-by-webgpu/
- WASM vs native measurements: Tremhost https://tremhost.com/blog/tremhost-labs-report-webassembly-vs-native-code-a-2025-production-performance-analysis/ ; CCGrid 2024 https://doi.org/10.1109/ccgrid59990.2024.00046 ; MPLR 2025 https://users.cs.northwestern.edu/~robby/pubs/papers/mplr2025-sf.pdf ; nickb.dev https://nickb.dev/blog/the-webassembly-value-proposition-is-write-once-not-performance/
- WebGPU browser support: https://web.dev/blog/webgpu-supported-major-browsers ; https://github.com/gpuweb/gpuweb/wiki/Implementation-Status

Others:
- O3DE license: https://raw.githubusercontent.com/o3de/o3de/main/LICENSE.txt ; web epic: https://github.com/o3de/o3de/issues/19082 ; roadmap https://o3de.org/roadmap/
- OpenSceneGraph maintenance mode / successor: https://openscenegraph.github.io/openscenegraph.io/ ; https://github.com/openscenegraph/OpenSceneGraph/discussions/1285 ; https://github.com/openscenegraph/OpenSceneGraph/discussions/1291
- Qt 3D deprecation: https://doc.qt.io/qt-6/whatsnew68.html ; removal from release config https://lists.qt-project.org/pipermail/development/2024-March/045127.html
