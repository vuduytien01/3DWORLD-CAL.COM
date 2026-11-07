# Scientific literature: web 3D rendering vs native rendering (performance evidence)

Compiled 2026-11-06 for the capstone technology-overview chapter (hospital booking + exam pipeline + AI guide, web app in Docker). Scope: peer-reviewed papers and technical reports comparing web-based 3D rendering (WebGL/WebGPU, Three.js, Unity/Unreal web export, WebAssembly) against native rendering (OpenGL/Vulkan, C++ engines), with building/walkthrough/digital-twin relevance.

Search method: seven distinct query framings plus a citation-graph sweep over the Firecrawl research index (arXiv, PubMed/PMC, DOI-indexed sources). Roughly 60 unique candidates reviewed, 10 included. This is a partial search, not an exhaustive review. No paper was found that directly benchmarks Unity/Unreal WebGL export against a native OpenGL/Vulkan build of the same walkthrough scene, so that comparison must be justified by proxy evidence below or measured firsthand in the capstone.

## What the literature says

Peer-reviewed evidence places web execution measurably below native but workable. On CPU-bound work, WebAssembly runs a mean 1.45x to 1.55x slower than native across SPEC CPU benchmarks, with peaks of 2.5x, caused partly by sandboxing checks and partly by weaker JIT register allocation (Jangda et al., verified). For rendering, browsers are judged "on the verge of becoming a competitive platform" even for terascale visualization when WebGPU plus WebAssembly are used with heavy engineering (Usher and Pascucci, verified). Within the web stack, WebGPU clearly outperforms WebGL for GPU compute (Sung et al., abstract-level), and browser GPU calls carry a real per-dispatch validation overhead of roughly 24 to 36 microseconds on Vulkan backends, enough that dispatch-heavy browser GPU work reaches only 11 to 12 percent of CUDA throughput at batch size 1 (Maczan, abstract-level). For building-scale digital twins, web stacks succeed when data is tiled, lightweight, and LOD-managed: MapLibre/deck.gl beat CesiumJS on large point clouds by a factor of thousands in blocking time, and MVT building display paints in 0.8 s (Seto et al., verified); a browser-native WebGPU MRI digital twin holds 82+ FPS on integrated GPUs (Beckley, abstract-level). Hospital-domain studies confirm browser delivery is established practice for medical 3D and wayfinding (Min et al. 2018; Salins et al. 2025, abstract-level). Engine comparisons between Unity and Unreal cover rendering fidelity and efficiency but stay on native/VR targets (Berrezueta-Guzman and Wagner, abstract-level).

## Papers

| Paper | Venue/year | ID/URL | One-line relevance | Verification |
|---|---|---|---|---|
| Jangda, Powers, Berger, Guha. "Not So Fast: Analyzing the Performance of WebAssembly vs. Native Code" | arXiv preprint, 2019 | [arXiv:1901.09056](https://arxiv.org/abs/1901.09056) | First large-scale WebAssembly-vs-native benchmark: mean 1.45-1.55x slowdown, peak 2.5x, with root causes; bounds what C++ engines compiled to WASM can expect in the browser | Body passage |
| Usher, Pascucci. "Interactive Visualization of Terascale Data in the Browser: Fact or Fiction?" | arXiv preprint (VGTC-formatted), 2020 | [arXiv:2009.03254](https://arxiv.org/abs/2009.03254) | Direct assessment of WebAssembly+WebGPU vs native scientific visualization, including programming-effort cost and a 30 FPS WebGPU isosurface demo; concludes browsers are "on the verge" of competitiveness | Body passage |
| Seto, Shiwaku, Miyauchi, Yoshida, Nishimura. "Assessment of Display Performance and Comparative Evaluation of Web Map Libraries for Extensive 3D Geospatial Data" | arXiv preprint (ISPRS-formatted), 2026 | [arXiv:2602.23660](https://arxiv.org/abs/2602.23660) | Measured Core Web Vitals for CesiumJS vs MapLibre GL JS + deck.gl on real PLATEAU building models and 30 TB point clouds; gives concrete selection guidelines for web 3D building visualization | Body passage |
| Sung, Ma, Kim, Choi, Choi, Hong. "Real-Time Cloth Simulation Using WebGPU: Evaluating Limits of High-Resolution" | arXiv preprint, 2025 | [arXiv:2507.11794](https://arxiv.org/abs/2507.11794) | Quantifies the WebGPU-over-WebGPU vs WebGL gap inside the browser: 60 FPS at 640K nodes with WebGPU; supports choosing WebGPU-era stacks over legacy WebGL | Abstract-only |
| Maczan. "Characterizing WebGPU Dispatch Overhead for LLM Inference Across Four GPU Vendors, Three Backends, and Three Browsers" | arXiv preprint, 2026 | [arXiv:2604.02344](https://arxiv.org/abs/2604.02344) | Measures WebGPU vs native GPU backends (Dawn, wgpu-native, Vulkan/Metal): per-dispatch validation overhead 24-36 us and browser stacks at 11-12% of CUDA in dispatch-heavy workloads | Abstract-only |
| Asadi. "Decomposing Browser Pipeline Architectures for DOM-Sourced Particle Effects: Worker Offload, WebGL, and WebAssembly" | arXiv preprint, 2026 | [arXiv:2608.23609](https://arxiv.org/abs/2608.23609) | Controlled browser-architecture benchmark: worker offload lifts FPS ~52 to ~144, WASM speeds kernels 1.5-1.6x, yet WASM wins need not raise end-user FPS; shows bottleneck placement matters more than raw speedups | Abstract-only |
| Berrezueta-Guzman, Wagner. "Choosing the Right Engine in the Virtual Reality Landscape" | arXiv preprint, 2025 | [arXiv:2508.13116](https://arxiv.org/abs/2508.13116) | Empirical Unity vs Unreal comparison on rendering fidelity, computational efficiency, and cross-platform trade-offs; usable for the engine-choice section of the technology overview | Abstract-only |
| Min, Wang, Liu. "An Evaluation of HTML5 and WebGL for Medical Imaging Applications" | Peer-reviewed journal, 2018 (DOI [10.1155/2018/1592821](https://doi.org/10.1155/2018/1592821), PMC6136584) | Same DOI | Shows HTML5+WebGL handles 2D/3D medical imaging with real-time fly-through over LAN and WAN; direct evidence web 3D is viable in the hospital domain | Abstract-only |
| Beckley. "Decentralized Direct Volume Rendering: A Browser-Native GPU Architecture for MRI Digital Twins in Resource-Constrained Settings" | arXiv preprint, 2026 | [arXiv:2605.19737](https://arxiv.org/abs/2605.19737) | WebGPU digital twin of patient MRI running client-side: TTFP under 920 ms and 82+ FPS on integrated GPUs; the closest published analog to a browser-based hospital 3D twin | Abstract-only |
| Salins, Anandan, Ananda, Reshmi, Jathanna. "Internet of Things-Based Wayfinding for Hospital Visitors" | Mayo Clinic Proceedings: Digital Health (per DOI), 2025 (DOI [10.1016/j.mcpdig.2025.100293](https://doi.org/10.1016/j.mcpdig.2025.100293), PMC12613019) | Same DOI | Browser-based hospital wayfinding app (Leaflet, 5 floors, 758 routes) validated with 54 users: 85.2% found it easy, 87% reported faster navigation; grounds the delivery model for hospital guidance | Abstract-only |

## Verified passages (top 3, quoted from paper bodies)

**Jangda et al., arXiv:1901.09056 (WebAssembly vs native).**

> "we find a substantial gap between WebAssembly and native performance: code compiled to WebAssembly runs on average 1.55x slower in Chrome and 1.45x slower in Firefox than native code (§4)"

> "We find that the mean slowdown of WebAssembly vs. native across SPEC benchmarks is 1.55x for Chrome and 1.45x for Firefox, with peak slowdowns of 2.5x in Chrome and 2.08x in Firefox."

> "The four other issues that we have identified appear to arise from the design constraints of WebAssembly: the stack overflow checks (§6.2.2), indirect call checks (§6.2.3), and reserved registers (§6.1.1) have a runtime cost and lead to increased code size (§6.3). Unfortunately, these checks are necessary for WebAssembly's safety guarantees."

Body also reports measured counters: 2.02x more loads and 2.30x more stores in Chrome, and 2.83x more L1 instruction-cache misses in Chrome versus native. Note this measures CPU-side execution of C/C++ on SPEC CPU 2006/2017, not GPU rendering.

**Usher and Pascucci, arXiv:2009.03254 (browser vs native visualization).**

> "In a study of various compute benchmarks, Jangda et al. found WebAssembly to be 1.5-3.4x slower than native code, depending on the task. These slowdowns can be partly attributed to enforcing WebAssembly's security guarantees, which require some additional checks to be performed."

> "WebGPU is a new low-level graphics API for the browser, similar in spirit to DirectX 12, Vulkan, and Metal, although it provides an easier-to-use API. WebGPU exposes advanced rendering and compute functionality to significantly expand the GPU capabilities available to browser applications compared to WebGL."

> "The surface consists of 137.5M triangles and is computed in 526ms on an RTX 2070 using WebGPU in Chrome and rendered at 30FPS at 1280x720. The original surface, shown in the right split image, consists of 4.3B triangles and was computed with VTK's Flying Edges filter on a quad-socket Xeon server in 78s using 1.3TB of memory."

> "We conclude that web browsers are on the verge of becoming a competitive platform for even the most demanding scientific visualization tasks, such as interactive visualization of isosurfaces from a 1TB DNS simulation."

Caveat stated by the paper itself: the browser result applies "advanced precision and resolution trade-offs", so the browser and server numbers are not a like-for-like race; the comparison is partly architectural and partly qualitative.

**Seto et al., arXiv:2602.23660 (web 3D libraries on real building models).**

> "The best performance was demonstrated by MapLibre GL JS utilizing the MVT format for building display, achieving FCP 0.8 s and Speed Index 0.8 s with TBT 0 ms across both the 3rd and 2nd meshes, demonstrating the advantages of lightweight vector data."

> "Large-scale point-cloud processing revealed significant differences in the library performance. CesiumJS experienced extreme response delays, with a TBT of 7,270 milliseconds in 3rd mesh and 21,357 milliseconds in 2nd mesh. Conversely, MapLibre GL JS maintained a TBT below 3 ms under identical conditions, confirming the optimization effectiveness of deck.gl and loaders.gl integration."

> "The evaluation results clarified the use-case-specific optimal selection guidelines for MVT for lightweight data, MapLibre GL JS and deck.gl for large-scale point clouds, and CesiumJS for high-precision 3D visualization."

Note these are load-time and responsiveness metrics (Google Lighthouse Core Web Vitals over three cached-off runs), not steady-state rendering FPS.

## Gaps and caveats for the report

- No indexed paper directly benchmarks a Unity/Unreal WebGL export against the same scene built in native C++ with OpenGL/Vulkan. The native-vs-web conclusion must be assembled from proxies: Jangda for CPU side, Usher/Maczan for GPU side, Seto for building-scale web data.
- Jangda's numbers are CPU benchmarks, not rendering; quoting them as "the web is 1.5x slower" for graphics overstates precision.
- Seto's TBT and FCP measure interactivity and paint, not sustained frame rate.
- Most included papers are arXiv preprints per the index metadata; verify final publication venues (for example, Jangda et al. appeared at OOPSLA and Usher and Pascucci in an IEEE Computer Graphics and Applications-style venue) against publisher pages before final citation.
- The optional citation-graph sweep found no additional direct web-vs-native rendering benchmark, which supports stating this as an open comparison in the chapter.

## Sources

- https://arxiv.org/abs/1901.09056
- https://arxiv.org/abs/2009.03254
- https://arxiv.org/abs/2602.23660
- https://arxiv.org/abs/2507.11794
- https://arxiv.org/abs/2604.02344
- https://arxiv.org/abs/2608.23609
- https://arxiv.org/abs/2508.13116
- https://doi.org/10.1155/2018/1592821 (PMC6136584)
- https://arxiv.org/abs/2605.19737
- https://doi.org/10.1016/j.mcpdig.2025.100293 (PMC12613019)
