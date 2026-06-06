# Graph Report - School-Digital-Twin-XR  (2026-06-06)

## Corpus Check
- 1 files · ~4,370 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 60 nodes · 116 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6b5f9d5d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]

## God Nodes (most connected - your core abstractions)
1. `isMobileDevice()` - 8 edges
2. `finishLoading()` - 8 edges
3. `showToast()` - 6 edges
4. `applyRoomLimits()` - 5 edges
5. `beginModelLoad()` - 5 edges
6. `startLookControls()` - 5 edges
7. `initLoading()` - 5 edges
8. `onTourMovementTick()` - 4 edges
9. `modelHasGeometry()` - 4 edges
10. `setPlayerPosition()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `getMoveInput()` --calls--> `isMobileDevice()`  [EXTRACTED]
  main.js → main.js  _Bridges community 4 → community 6_
- `requestOrientationOnTap()` --calls--> `isMobileDevice()`  [EXTRACTED]
  main.js → main.js  _Bridges community 4 → community 7_
- `preloadClassroomVideo()` --calls--> `showToast()`  [EXTRACTED]
  main.js → main.js  _Bridges community 0 → community 3_
- `startLookControls()` --calls--> `showToast()`  [EXTRACTED]
  main.js → main.js  _Bridges community 0 → community 4_
- `finishLoading()` --calls--> `applyRoomLimits()`  [EXTRACTED]
  main.js → main.js  _Bridges community 5 → community 2_

## Communities (11 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.22
Nodes (10): refreshVideoScreenMaterial(), seekVideo(), setupVideoControls(), showToast(), toggleVideoMute(), toggleVideoPlay(), toggleVideoVisibility(), updateVideoHideButton() (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.53
Nodes (6): alignCampusToFloor(), finishLoading(), getCampusMesh(), modelHasGeometry(), tryClaimModelLoaded(), tryCompleteLoading()

### Community 3 - "Community 3"
Cohesion: 0.33
Nodes (6): classifyVideoUrl(), initLoading(), isFileProtocol(), preloadClassroomVideo(), startLoadingProgress(), startSlowLoadHint()

### Community 4 - "Community 4"
Cohesion: 0.53
Nodes (6): applyLookControls(), applyMobileSceneTuning(), isMobileDevice(), requestScenePointerLock(), setupDesktopPointerLock(), startLookControls()

### Community 5 - "Community 5"
Cohesion: 0.4
Nodes (5): applyRoomLimits(), bindTeleportPads(), buildInvisibleWalls(), layoutHelperFloor(), layoutTeleportPads()

### Community 6 - "Community 6"
Cohesion: 0.5
Nodes (4): ensureMovementVectors(), fillHorizontalCameraBasis(), getMoveInput(), onTourMovementTick()

### Community 7 - "Community 7"
Cohesion: 0.5
Nodes (4): requestOrientationOnTap(), setAmbience(), startTour(), unlockAudio()

### Community 8 - "Community 8"
Cohesion: 0.5
Nodes (4): framePlayerInRoom(), getEyeHeight(), resetCameraRotation(), setPlayerPosition()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (4): attachModelToScene(), beginModelLoad(), downloadModel(), setLoadingProgress()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `finishLoading()` connect `Community 2` to `Community 1`, `Community 3`, `Community 5`, `Community 8`, `Community 9`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `isMobileDevice()` connect `Community 4` to `Community 1`, `Community 6`, `Community 7`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `showToast()` connect `Community 0` to `Community 1`, `Community 3`, `Community 4`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._