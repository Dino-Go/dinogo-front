# Geofencing Feature: Checkpoints Proximity Detection

## Purpose

- Detect when the user enters or exits the vicinity of one of the defined checkpoints.
- Trigger specific actions on **enter**, **exit**, or optionally **dwell** (user stays inside the zone for some time).
- Integrate with existing map / WebGL overlay code in React/Next so that the behavior is smooth and efficient.

---

## Assumptions & Context

- You have a list of checkpoint objects, each with `id`, `label`, `lat`, `lng` (and possibly other metadata).  
- User’s location is tracked continuously, e.g. via `navigator.geolocation.watchPosition`.  
- There is a state or reference for `userLocation` being updated.  
- There is an existing `useEffect` (or similar) that fires on updates to `userLocation`.  
- The map overlay uses WebGL and transforms positions of user marker and checkpoint pins.  

---

## Geofencing Requirements

1. **Proximity Radius / Threshold**
   - Define a radius (in meters) around each checkpoint, e.g. `GEOFENCE_RADIUS_METERS = 50` (or configurable).  
   - When distance from user to checkpoint ≤ radius, consider user “inside”.  

2. **Events / Triggers to support**
   - **Enter**: when user enters the radius of a checkpoint (was outside, now inside).  
   - **Exit**: when user leaves that radius (was inside, now outside).  
   - **Dwell** (optional): when user remains inside a checkpoint for a minimum period (e.g. `DWELL_THRESHOLD_MS`), trigger some dwell action.

3. **Actions on Triggers**
   - Developer should be able to define functions `onEnterCheckpoint(checkpoint)`, `onExitCheckpoint(checkpoint)`, `onDwellCheckpoint(checkpoint)` to perform what is needed (UI update, navigation, alert, server call, etc.).  
   - Ensure actions fire exactly when needed (avoid repeat firing if already inside etc.).

4. **State Management**
   - Maintain a set of checkpoint IDs that the user is currently inside (`insideCheckpoints`).  
   - Maintain timestamps for when user entered each checkpoint for dwell detection (`enterTimestamps`).  

5. **Performance / Efficiency**
   - Only compute distances on location updates (do not run a heavy loop more frequently than necessary).  
   - If there are many checkpoints, optionally filter by bounding box or use spatial index to reduce checks.  
   - Use geodesic distance (as in your existing `getDistanceFromLatLonInKm`) but convert to meters.

6. **Edge cases & Accuracy**
   - GPS inaccuracies: maybe allow buffer / smoothing.  
   - Mobile vs desktop: consider accuracy fluctuations.  
   - Permission denial cases.  

---

## Suggested Implementation Steps

Below is a sketch of how Claude Code should modify or add code to your project:

```ts
// --- Configuration constants at top of component or in config file
const GEOFENCE_RADIUS_METERS = 50;  // adjust per requirement
const DWELL_THRESHOLD_MS = 10000;   // e.g. 10 seconds

// --- State & refs
const [insideCheckpoints, setInsideCheckpoints] = useState<Set<string>>(new Set());
const enterTimestamps = useRef<Map<string, number>>(new Map());

// --- Functions for actions
function onEnterCheckpoint(cp: Checkpoint) {
  // e.g. show alert or do whatever
  console.log(`Entered checkpoint ${cp.label}`);
}
function onExitCheckpoint(cp: Checkpoint) {
  console.log(`Exited checkpoint ${cp.label}`);
}
function onDwellCheckpoint(cp: Checkpoint) {
  console.log(`Dwelling at checkpoint ${cp.label}`);
}

// --- Effect: run whenever userLocation (and checkpoints) changes
useEffect(() => {
  if (!checkpoints.checkpoints) return;

  const newInside = new Set<string>();

  checkpoints.checkpoints.forEach(cp => {
    const distKm = getDistanceFromLatLonInKm(
      userLocation.lat, userLocation.lng,
      cp.lat, cp.lng
    );
    const distMeters = distKm * 1000;

    if (distMeters <= GEOFENCE_RADIUS_METERS) {
      newInside.add(cp.id);

      if (!insideCheckpoints.has(cp.id)) {
        // Enter event
        onEnterCheckpoint(cp);
        enterTimestamps.current.set(cp.id, Date.now());
      } else {
        // Already inside; check dwell
        const enterTime = enterTimestamps.current.get(cp.id);
        if (enterTime && Date.now() - enterTime >= DWELL_THRESHOLD_MS) {
          // Only fire dwell once per checkpoint
          onDwellCheckpoint(cp);
          // Optionally clear or mark so dwell doesn't fire repeatedly
          enterTimestamps.current.delete(cp.id);
        }
      }
    } else {
      // Outside threshold
      if (insideCheckpoints.has(cp.id)) {
        // Exit event
        onExitCheckpoint(cp);
        enterTimestamps.current.delete(cp.id);
      }
    }
  });

  setInsideCheckpoints(newInside);
}, [userLocation, checkpoints.checkpoints]);