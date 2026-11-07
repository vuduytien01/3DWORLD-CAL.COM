# Hospital 3D domain research — what real deployments actually render (2026-11-06)

Scope: how real products and hospitals use 3D for wayfinding / navigation / digital twins, and what level of 3D actually adds value for a patient-guidance product. All quotes below are from fetched pages (treated as untrusted data; only mined for signal). Claim labels: **measured** (source states it directly), **inferred** (reasonable read across sources), **guess** (uncertain).

---

## Executive answer (10 lines)

1. Real deployments split into four levels: (a) photo/landmark turn-by-turn (Eyedog, 50+ hospitals), (b) stylized 2D/2.5D-3D interactive map viewers (Mappedin, Pointr, Jibestream, 3D Wayfinder) on kiosk+web+QR, (c) photo-real Matterport digital twins used for pre-visit familiarization, not live navigation, (d) Unity/Unreal game-engine twins used staff-facing for patient-flow simulation. [measured]
2. No leading patient-facing turn-by-turn product renders with a real-time 3D engine. Eyedog explicitly refuses maps ("Maps don't contribute to wayfinding performance"), and Eye-In positions 3D/AR as a garnish on a 2D route plus 360 photos. [measured]
3. Cognitive research agrees detail hurts: landmark-only interfaces beat detailed floor plans (Bauer 2018, N=118), signs beat maps (Hölscher 2007), photos and text both impose low mental effort (PMC 2021). [measured]
4. The one strong pro-3D result: 3D route-PLANNING support (overview before walking) in a large hospital gave faster navigation, fewer errors, less anxiety (van Schaik 2015, N=40). 3D helps at the planning/orientation stage, not turn-by-turn. [measured]
5. Where 3D shows measured patient value: Matterport digital twins reduce pre-visit anxiety (Alder Hey: 30k+ unique visits, 77% "totally or significantly reduce anxiety") and reduce staff interruptions. [measured]
6. Unity/Unreal healthcare twins simulate patient flow / OR / ED operations for managers and do VR patient preparation (Sant Pau, Changi ED); they are client-rendered (desktop/VR headset) or a web app, never server-rendered streams to patients' phones. [measured/inferred]
7. Adoption reality: patients don't install hospital apps; web/QR/appointment-embedded guidance wins (Eyedog claims 7–8x higher usage vs downloadable apps; Pointr uses App Clips; Eye-In hands off kiosk route to phone via QR). [measured]
8. Apple/Google indoor maps are non-routable "pretty floor plans" for hospitals, which is why hospitals buy dedicated systems. [measured, community+vendor]
9. For a patient-guidance product like this capstone: the valuable "3D" is a lightweight stylized 2.5D overview map (or photo-real pre-visit tour), while the core value is pipeline guidance (what happens next) + landmark cues + 2D plans. Full engine 3D is decoration for patients. [inferred]
10. Vietnam runs the same pattern one step behind: static sơ đồ images in public hospitals, first kiosk/QR digitized maps (InMapz at Hanoi Univ. of Medicine hospital), and 3D-as-marketing at private clinics (Mediplus). [measured]

---

## Vendor / product table

| Product | What it renders | Platform | Notes |
|---|---|---|---|
| **Eyedog** (NL/US) | Photo landmark turn-by-turn; explicitly **no maps, no 3D** | Web-first (no app download), embedded in appointment notifications/EMR; optional native app | 50+ hospitals across US/EU/CA/AU; claims 94–97% reach destination without asking staff; 7–8x usage vs app-based nav; go-live 2–3 weeks; ~2 weeks to map a 100,000 m² hospital (150–200 locations, ~40k routes). [measured, vendor claims] |
| **Jibestream / Inpixon (NovoMap, now Intra Maps)** | Geospatially accurate **2D vector floor plans** on a 3D-capable platform; rendering engine "merges the location dimension" | Native kiosks (Web/iOS/Android SDKs), SaaS | VA hospitals kiosk deployments; Lee Health built iOS/Android app in ~1 month; Kaleida Health turn-by-turn in <1 month. VA TRM lists companion formats: AutoCAD, JSON, JPEG/PNG/SVG — i.e., 2D assets, not 3D models. [measured] |
| **Mappedin** | **2D floor plans transformed into stylized 3D interactive maps** (pan/zoom/rotate, no photo-realism) | Web SDK, kiosks, mobile | Hospital buyer's guide prioritizes outdoor-to-indoor continuity, EHR/MyChart integration, WCAG, <60-day deploy — 3D fidelity is not a listed criterion. [measured] |
| **Pointr (MapScale, now owns Purple)** | AI-converted CAD → **interactive 2D/3D maps**; maps-only deployments supported | Web, App Clips (Pointr Express), MyChart integration | UCHealth deployment expanded +1.5M sq ft; live in Epic Showroom; MyChart web reach cited as <10% of population for native-only solutions. [measured, vendor claims] |
| **3D Wayfinder** | True **stylized 3D building model** (buildings, wings, floors) for campus overview + route guidance | Kiosk, web embed | Tartu University Hospital (Estonia): 3D model chosen because "a traditional 2D floor plan does not always show relationships clearly" — overview/orientation use case, no indoor positioning. [measured] |
| **Eye-In Media (Wayfinder)** | **2D route + 360° photos per turn** ("Think Google Maps, then Google Street View") + AR arrows | Kiosk → QR handoff to phone, web | Explicit analogy: map draws route, Street-View-like 360s show what each turn looks like. [measured] |
| **Matterport digital twins (via VisualEyes, FotoEstate, Ocean3D, H&H, The Future 3D)** | **Photo-real 3D scans (digital twin)** with hotspots, virtual signage, videos; some add navigation plugins/Mattertags | Web (any device, 4K), Google Maps/Street View | Alder Hey (UK, 188k sq ft, 156 hotspots, 74 videos); Städtisches Klinikum Karlsruhe (nav plugin, claims 40% registration-wait reduction); Ocean3D NHS RCHT theatre tour ~0.5M Google views. Used for anxiety reduction + marketing, not live turn-by-turn. [measured] |
| **Unity / Unreal healthcare digital twins** | **Game-engine 3D** of hospital spaces; patient-flow/occupancy simulation, VR patient preparation | Client-rendered: desktop/VR headsets (Unity/Unreal); one web app (BIM6D) with 2D/3D BIM panels | Hospital Sant Pau (Unreal + VR for patient prep; separate web sim of radiology patient flow); Changi General Hospital ED twin (open-source game engine); Unity VR ED patient-flow visualizations; NHS ward simulation in Unity. None are patient-facing turn-by-turn. [measured] |
| **AnyLogic / discrete-event twins** | Non-3D simulation with 2D dashboards + queue reports | Desktop/web reports | Cheltenham/Gloucestershire hospitals 75-unit twin — shows operations twins don't need a game engine. [measured] |
| **Apple / Google indoor maps** | **Non-routable floor plans** ("pretty floor plans") | Phone OS | Community: hospitals run dedicated wayfinding systems because Apple/Google lack a routable indoor graph. [measured, community] |

---

## Themes (with confidence labels and verbatim quotes)

### Theme 1 — Hospital wayfinding is a real, expensive pain. **Confidence: HIGH** (7+ independent sources, unprompted)
Sentiment: pain. [measured across all]

- "In every hospital I have ever set foot in, I easily got lost. The signs and maps on the wall did not always lead me to where I needed to be, and indoor Google Maps still does not seem to be a thing." — physician, Doximity opmed, https://opmed.doximity.com/articles/finding-your-way-within-the-hospital-should-not-be-this-complicated (no date shown) [measured]
- "Navigating a large hospital like PVHMC can be confusing and stressful for patients and visitors who may already be feeling anxious about their visit." — CIO, Pomona Valley Hospital, 2022-04-19, https://www.pvhmc.org/blog/2022/april/pomona-valley-hospital-medical-center-and-eyedog/ [measured]
- "the frustrating experience of navigating large, complex buildings like hospitals. … In a place where stress is already high, bad navigation makes everything worse." — dev, r/SaaS "Hospital wayfinding is broken", 2025-09-13, https://www.reddit.com/r/SaaS/comments/1ng4b57/ (comments not retrievable; post body via cache) [measured]
- "The VA estimates it loses $1.5-billion a year because of missed appointments, many of which are the result of patients getting as far as the hospital building but not being finding the doctor's office in time." — Globe and Mail, 2013-03-15, https://www.theglobeandmail.com/report-on-business/small-business/sb-managing/next-app-frontier-wheres-the-washroom-in-this-place/article9023606/ [measured, dated]
- Eyedog reseller: "Mitigate the Cost of Confusion: Save $500k for a 600-bed hospital with 500k outpatient visits." — Intraprise, 2022-08-18, https://intraprise.com/knowledge-exchange/isi_post_70/ [measured, vendor claim]
- Vietnam: "Bối rối, mất phương hướng… Mệt mỏi và lo âu… Quá tải quầy hướng dẫn" — Mediplus, 2026-08, https://www.mediplus.vn/tin-tuc/mediplus-da-co-map-3d-tro-ly-chi-duong-ngay-tren-smartphone.html [measured]
- Vietnam: "Bệnh viện thường có cấu trúc phức tạp… Nhân viên y tế… mất thời gian để chỉ đường" — InMapz case study, https://vn.inmapz.com/benh-vien-dai-hoc-y-ha-noi/ [measured]

### Theme 2 — Deployed turn-by-turn products AVOID maps and 3D; they use photos/landmarks + simple cues. **Confidence: HIGH** (Eyedog, Eye-In, Intraprise, academic corroboration)
Sentiment: alternative (what works instead). [measured]

- "Maps don't contribute to wayfinding performance (Butler et al, 1990). People love simple-to-follow directions with recognition-based validation." — Eyedog, https://eyedog.mobi/mobile-wayfinding-solutions [measured]
- "Photos Not Maps: Navigate by swiping from photo to photo… more intuitive than abstracting your location and direction from the plan view of a map." — Eyedog.US, https://eyedog.us/ [measured]
- "Simply displaying a path on a map or projecting it as an AR overlay is not enough." — Eyedog blog, 2024-11-27, https://eyedog.mobi/blog/the-complexity-of-digital-indoor-wayfinding-for-hospitals-and-how-we-tackle-it [measured]
- "Think Google Maps, then Google Street View… The map draws the route from the entrance to cardiology on floor 4. The 360 views show the actual corridor." — Eye-In, https://eye-in.com/interactive-wayfinding/healthcare [measured]
- "Most wayfinding solutions don't work. Not the signs, not the apps, not the maps. Tools to support wayfinding in hospitals are often artistic show pieces or technical shiny objects." — Eyedog homepage, https://eyedog.mobi/ [measured]
- Academic: "very detailed map material harms efficient navigation… Users navigating with the latter [landmark-only] interface reached their goal faster." — Bauer 2018, Univ. Regensburg (N=118), https://epub.uni-regensburg.de/37666/ [measured]
- Academic: "signage had the largest impact on wayfinding performance, while maps alone showed the smallest level of support… In the co-presence of signs, map usage dropped by 66%." — Hölscher et al. 2007, https://escholarship.org/uc/item/1z3190s6 [measured]
- Academic: "several studies have shown that… participants prefer images to visualise the environment while executing wayfinding tasks indoors… photographs lead to improved wayfinding performance." — PMC 2021, https://pmc.ncbi.nlm.nih.gov/articles/PMC7903249/ [measured]

### Theme 3 — Patient-facing 3D shows value ONLY as (a) pre-visit photo-real tours (anxiety) and (b) overview/route-planning support. **Confidence: MEDIUM–HIGH** (multi-source for tours; single strong study for 3D planning)
Sentiment: outcome (where 3D pays). [measured for deployments, measured for the study]

- "The digital twin is a key asset… used by over 50,000 visitors in its first year… 30,000 unique visits, with a 77% feedback rate of 'Totally or Significantly reduce anxiety'." — Alder Hey project lead, LinkedIn, 2026-10-22, https://linkedin.com/in/carltimms [measured, single-source numbers]
- "designed… to help reduce anxiety and nerves… Europe's largest 360° hospital Matterport virtual tour… 188,000 square feet… 156 interactive 'hotspots'." — Alder Hey NHS, 2024-10-01, https://www.alderhey.nhs.uk/interactive-360-virtual-map-of-alder-hey/ [measured]
- "3-D route-planning support… resulted in faster navigation, more use of artwork… fewer navigation errors, less disorientation and less anxiety… acceptance of 3-D route-planning support was high." — van Schaik et al. 2015, large hospital, N=40, https://doi.org/10.1080/0144929x.2015.1004649 [measured]
- "if it proves popular, more tours could be created… Knowing what a building looks and feels like before you arrive can make the experience so much easier." — TEWV NHS, 2025-01-14, https://www.tewv.nhs.uk/pioneering-project-to-ease-patient-anxiety-launched/ [measured]
- Karlsruhe hospital: Matterport + nav plugin; claims "waiting times in the treatment processes were reduced by an impressive 40%" — FotoEstate case study, https://fotoestate.de/en/fallstudien/indoor-navigation-klinikum-karlsruhe [measured, vendor claim, single source]

### Theme 4 — Adoption reality: no app installs; web/QR/appointment-embedded wins. **Confidence: HIGH** (Eyedog, Pointr, Eye-In, community)
Sentiment: alternative / constraint. [measured]

- "7–8× Higher usage compared to downloadable, app-based navigation solutions." — Eyedog, https://eyedog.mobi/ [measured, vendor claim]
- "Some people… don't want the additional burden of having to download and install an app when they arrive. In other words, apps and maps are not ideal for every hospital user." — Endpoint podcast with Eyedog CEO, 2023-01-24, https://www.weareendpoint.com/wayfinding-news-and-views/wayfinding-x-change-podcast-6-wayfinding-as-a-service-for-healthcare [measured]
- "Pointr Express® is built on Apple's App Clip technology… a no-download solution." — Pointr, https://www.pointr.tech/blog/how-to-implement-maps-indoor-navigation-epic-mychart [measured]
- "Once the directions are on the phone, the kiosk has done its job. The phone is the device that does the guiding." — Eye-In, https://eye-in.com/interactive-wayfinding/healthcare [measured]
- "venues that actually need indoor routing — universities and hospitals — run a dedicated wayfinding system instead of waiting on Apple or Google [whose] floor plans are drawn as nonrepresentational rooms… not as a routable network." — r/applemaps, 2024-12, https://www.reddit.com/r/applemaps/comments/1h8lwzz/ (via search snippet) [measured, snippet]

### Theme 5 — Unity/Unreal twins are staff/ops-facing (patient flow, OR/ED scheduling) or VR patient prep; client-rendered, not patient navigation. **Confidence: MEDIUM** (4 independent sources, all research/vendor)
Sentiment: alternative (adjacent, not patient-facing). [measured]

- "guided simulation… using avatars, 360° videos, and tools like Revit and Unreal Engine… so that the patient can train with virtual reality glasses before undergoing an interventional radiology procedure" + separate "BIM-based 2D/3D visualization" web app simulating radiology patient flow — BIM6D, Hospital Sant Pau, 2025-04-30, https://bim6d.eu/portfolio/digitaltwin-hospital-sant-pau/ [measured]
- "A DT model was built on an open-source game engine… to simulate real-time patient and staff activities… validated… using historical data." — Changi General Hospital ED, 2025-06-27 (conference abstract), https://tsem.blob.core.windows.net/newscontainer/Plenary%20lecture%20II-...pdf [measured]
- "This paper proposes to use Unity to develop two VR visualisations of patient flow to a hospital ED…" — AIS 2022, https://aisel.aisnet.org/confirm2022/1 [measured]
- "Current models are often Excel based and are static… This project shows the potential of a dynamic simulation in new ward designs." (Unity ward sim) — BJS 2023, https://doi.org/10.1093/bjs/znad241.424 [measured]
- Counterpoint: AnyLogic DES twin of two UK hospitals uses no game engine at all — https://www.anylogic.com/resources/case-studies/hospital-digital-twin-to-improve-operations-and-enhance-patient-experience/ [measured]

### Theme 6 — Operational complexity (rotating clinics, elevator closures, multi-step check-in) kills naive map products. **Confidence: MEDIUM** (Eyedog, Mappedin, Pointr; vendor voices)
Sentiment: pain (for hospitals/operators). [measured]

- "If a department moves, thousands of routes must be dynamically updated… rotating clinics… If your wayfinding solution can't accommodate this, it might be better to shut it down entirely." — Eyedog blog, 2024-11-27, https://eyedog.mobi/blog/the-complexity-of-digital-indoor-wayfinding-for-hospitals-and-how-we-tackle-it [measured]
- "If your staff calls it 'the B wing connector' but your signage says 'North Pavilion,' patients will get lost at that junction every time." — Mappedin, https://www.mappedin.com/resources/blog/how-to-improve-hospital-wayfinding/ [measured]
- Buyer criteria named: EHR/MyChart integration, real-time map updates without vendor intervention, multi-building campus, WCAG/ADA, <60-day deploy — https://www.mappedin.com/resources/blog/hospital-wayfinding-systems-guide/ [measured]

---

## Vietnam context

- **Mainstream patient apps are booking/queue-first, no indoor 3D.** Bạch Mai Care FAQ covers appointment booking, results, e-prescriptions — no wayfinding feature (https://bachmai.gov.vn/bai-viet/giai-dap-thac-mac-ve-ung-dung-bach-mai-care-... 2025). IVIE publishes static text guides + sơ đồ images ("Sơ đồ bệnh viện Bạch Mai: Hướng dẫn đi khám chi tiết", https://ivie.vn/so-do-benh-vien-bach-mai-...; similar for BV 19-8). BookingCare gives textual tips ("từ phía cổng đường Giải Phóng, ô tô rẽ trái…"). [measured] **Inferred gap:** in-hospital orientation in VN is served by static floor plans + staff directions, same pain as Theme 1.
- **InMapz at Bệnh viện Đại học Y Hà Nội** (Hanoi University of Medicine hospital): digitized map down to floor/room, route + estimated time/distance, kiosk software in lobby, QR to open map on phone, deployed across website/app/kiosk (https://vn.inmapz.com/benh-vien-dai-hoc-y-ha-noi/). Rendering is digitized 2D map (InMapz's product line); ~500,000 visits/yr, up to 3,000/day. [measured, vendor case study]
- **Mediplus (private clinic chain) Map 3D** (2026-08): QR on arrival → 3D map with AR view and "mô hình 3D thu nhỏ", position confirmation by photographing the nearest column number; framed as "trợ lý chỉ đường ảo" and smart-hospital branding; explicit goals: less load on receptionists, less patient confusion (https://www.mediplus.vn/tin-tuc/mediplus-da-co-map-3d-...). [measured] **Inferred:** in VN, 3D is currently a marketing/prestige feature at private facilities, not a standard.
- **Vietnamese vendors sell indoor 3D wayfinding for hospitals**: VR360 (Đà Nẵng) markets "bản đồ 3D tương tác, tìm đường, định vị trong tòa nhà… kết nối trực tiếp với bản vẽ CAD" (https://vr360.com.vn/di-chuyen-de-dang-hon-trong-benh-vien-bang-cong-nghe-dan-duong-trong-nha, updated 2023-12-01); GoodM sells kiosk wayfinding for hospitals (https://maytinhgoodm.com/products/giai-phap-chi-duong-cho-benh-vien). [measured, vendor pages]
- **Viettel Health / benhvien.vn portals**: no evidence found of any indoor 3D or indoor map feature (searched; nothing surfaced). [guess → absence of evidence, not evidence of absence]

**Implication for the capstone** [inferred]: a patient-guidance product for a Vietnamese hospital would be differentiated by pipeline guidance (ticket → queue → consultation → labs → re-consult → conclusion → payment), landmark cues, and a 2D/2.5D floor map — matching what actually deployed products worldwide do — with an optional Matterport-style pre-visit tour or stylized 3D overview as the "3D story", not a game-engine turn-by-turn.

---

## Sources

Vendor/deployment pages:
- https://eyedog.mobi/ ; https://eyedog.mobi/mobile-wayfinding-solutions ; https://eyedog.us/ ; https://eyedog.mobi/wayfinding-integration-emr ; https://eyedog.mobi/blog/unveiling-eyedog-30 ; https://eyedog.mobi/blog/the-complexity-of-digital-indoor-wayfinding-for-hospitals-and-how-we-tackle-it
- https://www.pvhmc.org/blog/2022/april/pomona-valley-hospital-medical-center-and-eyedog/ (2022-04-19)
- https://intraprise.com/knowledge-exchange/isi_post_70/ (2022-08-18) ; https://intraprise.com/knowledge-exchange/isi_post_22/
- https://marketplace.aviahealth.com/product/70527
- https://www.weareendpoint.com/wayfinding-news-and-views/wayfinding-x-change-podcast-6-wayfinding-as-a-service-for-healthcare (2023-01-24)
- https://www.healthitoutcomes.com/doc/jibestream-allies-vecna-patient-experience-intelligent-wayfinding-0001 (2014) ; https://www.casestudies.com/company/jibestream/case-study/how-indoor-mapping-and-real-time-location-technology-helped-lee-health-improve-patient-care-and-engagement ; https://www.prnewswire.com/news-releases/kaleida-health-adds-experiential-wayfinding-to-app-using-jibestreams-indoor-intelligence-platform-300422077.html (2017-03-14) ; https://www.oit.va.gov/Services/TRM/ToolPage.aspx?tid=8998 ; https://www.theglobeandmail.com/report-on-business/small-business/sb-managing/next-app-frontier-wheres-the-washroom-in-this-place/article9023606/ (2013-03-15)
- https://www.mappedin.com/industries/hospitals-healthcare/ ; https://www.mappedin.com/resources/blog/hospital-wayfinding-systems-guide/ ; https://www.mappedin.com/resources/blog/how-to-improve-hospital-wayfinding/ ; https://www.mappedin.com/resources/blog/best-hospital-navigation-apps/
- https://www.pointr.tech/sectors/healthcare ; https://www.pointr.tech/blog/indoor-mapping-and-navigation-for-hospitals-healthcare-facilities ; https://www.pointr.tech/epic-mychart-maps-wayfinding ; https://www.pointr.tech/blog/how-to-implement-maps-indoor-navigation-epic-mychart ; https://www.pointr.tech/blog/pointr-expands-uchealth-deployment
- https://3dwayfinder.com/feature/ (Tartu University Hospital)
- https://eye-in.com/interactive-wayfinding/healthcare
- https://www.alderhey.nhs.uk/interactive-360-virtual-map-of-alder-hey/ (2024-10-01) ; https://www.alderheycharity.org/alder-hey-launches-360-virtual-hospital-tour/ (2026-02-18) ; https://danslee.co.uk/2024/10/06/guest-post-how-an-innovative-360-degree-map-can-make-a-hospital-visit-less-scary/ (2024-10-06) ; https://linkedin.com/in/carltimms (2026-10-22)
- https://fotoestate.de/en/fallstudien/indoor-navigation-klinikum-karlsruhe ; https://ocean3d.co.uk/enhancing-healthcare-experiences-with-ocean-3ds-interactive-matterport-tours/ ; https://www.hnhmena.com/hospital-virtual-tours ; https://www.thefuture3d.com/industries/healthcare/3d-virtual-tours/ ; https://www.tewv.nhs.uk/pioneering-project-to-ease-patient-anxiety-launched/ (2025-01-14) ; https://www.360virtualtour.co/portfolio/hospital-indoor-navigation-mapping-virtual-tour/
- https://unity.com/solutions/healthcare

Digital twins / simulation:
- https://bim6d.eu/portfolio/digitaltwin-hospital-sant-pau/ (2025-04-30)
- https://tsem.blob.core.windows.net/newscontainer/Plenary%20lecture%20II-Application%20and%20Utility%20of%20Digital%20Twin%20in%20Emergency%20Department.pdf (Changi GH, 2025-06)
- https://aisel.aisnet.org/confirm2022/1 (2022) ; https://doi.org/10.1093/bjs/znad241.424 (2023) ; https://www.anylogic.com/resources/case-studies/hospital-digital-twin-to-improve-operations-and-enhance-patient-experience/ ; https://amsdottorato.unibo.it/id/eprint/12809/ ; https://doi.org/10.5772/intechopen.1002004 (2023) ; https://kariana-ai-med-sim.lovable.app/

Academic wayfinding:
- https://pmc.ncbi.nlm.nih.gov/articles/PMC7903249/ (photo vs text, 2021) ; https://escholarship.org/uc/item/1z3190s6 (Hölscher 2007) ; https://epub.uni-regensburg.de/37666/ (Bauer 2018) ; https://doi.org/10.1080/0144929x.2015.1004649 (van Schaik 2015, 3D route-planning in hospital) ; https://pmc.ncbi.nlm.nih.gov/articles/PMC4287692/ ; https://journal.futminna.edu.ng/index.php/etsj/issue/download/146/1187 (landmarks in hospital wayfinding, Nigeria)

Community:
- https://www.reddit.com/r/SaaS/comments/1ng4b57/hospital_wayfinding_is_broken_im_trying_to_fix_it/ (2025-09-13) ; https://www.reddit.com/r/applemaps/comments/1h8lwzz/what_is_the_point_of_having_an_indoor_map_if_u/ (via snippet) ; https://news.ycombinator.com/item?id=46485852 ("Blue dot navigation has failed because it doesn't translate to indoor spaces") ; https://news.ycombinator.com/item?id=24787005
- https://opmed.doximity.com/articles/finding-your-way-within-the-hospital-should-not-be-this-complicated

Vietnam:
- https://www.mediplus.vn/tin-tuc/mediplus-da-co-map-3d-tro-ly-chi-duong-ngay-tren-smartphone.html (2026-08)
- https://vn.inmapz.com/benh-vien-dai-hoc-y-ha-noi/
- https://vr360.com.vn/di-chuyen-de-dang-hon-trong-benh-vien-bang-cong-nghe-dan-duong-trong-nha (2023-12-01)
- https://maytinhgoodm.com/products/giai-phap-chi-duong-cho-benh-vien
- https://bachmai.gov.vn/bai-viet/giai-dap-thac-mac-ve-ung-dung-bach-mai-care-cung-ban-dong-hanh-cham-soc-suc-khoe-tu-xa?id=b6a1ac63-1656-4def-a0ee-f3c94263ea47
- https://ivie.vn/so-do-benh-vien-bach-mai-huong-dan-di-kham-chi-tiet-0 ; https://ivie.vn/so-do-benh-vien-va-huong-dan-lo-trinh-di-kham-chi-tiet-0
- https://bookingcare.vn/cam-nang/khoa-kham-theo-yeu-cau--benh-vien-bach-mai-kinh-nghiem-va-luu-y-khi-di-kham-p1276.html
