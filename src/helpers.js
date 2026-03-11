import * as THREE from 'three/webgpu';
export function buildStrataTexture(strataGrid, gridW, gridH, numLayers) {
  const data = new Uint8Array(gridW * gridH * numLayers);

 // Fix globalMax — skip col[0]
const globalMax = Math.max(...strataGrid.map(col =>
  Array.isArray(col) ? col.slice(1).reduce((a, b) => a + b, 0) : 0
)) || 1;

  for (let z = 0; z < gridH; z++) {
    for (let x = 0; x < gridW; x++) {
      const col = strataGrid[z * gridW + x];
      if (!Array.isArray(col)) continue;

      let running = 0;
      for (let y = 0; y < numLayers; y++) {
        running += col[y + 1] || 0;  // 👈 y+1 skips the year
        const idx = z * gridW * numLayers + y * gridW + x;
        data[idx] = Math.floor((running / globalMax) * 255);
      }
    }
  }

  const tex = new THREE.Data3DTexture(data, gridW, numLayers, gridH); // 👈 changed
  tex.format = THREE.RedFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.wrapR = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;

  return { tex, globalMax };
}





















export function aggregatedEventsToHeightArray(aggregatedEvents) {
   // console.log("agg events in aggregatedEventsToHeightArray", aggregatedEvents);
    if (!aggregatedEvents || aggregatedEvents.length === 0) return [];

    const heightArray = aggregatedEvents.map(composition =>
        composition.slice(1).reduce((sum, val) => sum + val, 0)    );
    return heightArray;
}



export function updatePlane12(geo, aggregatedEvents, curve_points = 64) {
  const MAX_TIMELINES = 16;
  const posAttr = geo.attributes.position;
  const vertexCount = posAttr.count;

  // DEAL WITH FAILURE CASE
  if (!aggregatedEvents || aggregatedEvents.length === 0) {
    geo.userData.numTimelines = 0;
    geo.userData.maxHeight = 0;
    geo.userData.minHeight = 0;
    const zeroBuf = new Float32Array(vertexCount);
    for (let t = 0; t < MAX_TIMELINES; t++) {
      geo.setAttribute(`timeline${t}`, new THREE.Float32BufferAttribute(zeroBuf, 1));
      geo.setAttribute(`band${t}`, new THREE.Float32BufferAttribute(zeroBuf, 1));
    }
    geo.setAttribute('heightBuffer', new THREE.Float32BufferAttribute(zeroBuf, 1));
    return geo;
  }

  let numTimelines = aggregatedEvents[0].length - 1;
  if (aggregatedEvents.length !== vertexCount) {
    console.warn('aggregatedEvents length must equal vertex count');
  }
  if (numTimelines > MAX_TIMELINES) {
    console.warn(`numTimelines (${numTimelines}) > MAX_TIMELINES (${MAX_TIMELINES}), truncating`);
    numTimelines = MAX_TIMELINES;
  }

  // ---- smooth heights ----
  const heightArray = aggregatedEventsToHeightArray(aggregatedEvents);
  const hMatrix = heightArrayToSmoothMatrix(heightArray);
  const smoothHeights = getSmoothArray(hMatrix, curve_points);

  const positions = posAttr.array;
  const heights = new Float32Array(vertexCount);
  let maxHeight = -Infinity;
  let minHeight = Infinity;

  for (let i = 0; i < vertexCount; i++) {
    const h = smoothHeights[i] < 0.55 ? 0 : smoothHeights[i];
    heights[i] = h;
    if (h > maxHeight) maxHeight = h;
    if (h < minHeight) minHeight = h;
    positions[i * 3 + 1] = h;
  }

  posAttr.needsUpdate = true;
  geo.computeVertexNormals();

  // ---- smooth each timeline layer independently ----
  // Build a raw float array per layer, smooth it, store it
  const smoothedLayers = [];

  for (let t = 0; t < numTimelines; t++) {
    // Extract raw values for this layer across all vertices
    // aggregatedEvents resolution
    const baseCount = aggregatedEvents.length;
    const rawLayer = new Array(baseCount);

    for (let v = 0; v < baseCount; v++) {
      const row = aggregatedEvents[v];
      rawLayer[v] = row ? (row[t + 1] ?? 0) : 0;
    }

    // Re-use the same spline smoothing pipeline as heights
    // heightArrayToSmoothMatrix applies log scaling — for layers
    // we want raw smoothing so we inline a simpler matrix build
    const gridSize = Math.sqrt(baseCount);
    const layerMatrix = [];
    for (let row = 0; row < gridSize; row++) {
      const rowVectors = [];
      for (let col = 0; col < gridSize; col++) {
        const idx = row * gridSize + col;
        rowVectors.push(new THREE.Vector2(col, rawLayer[idx] ?? 0));
      }
      layerMatrix.push(rowVectors);
    }

    const smoothed = getSmoothArray(layerMatrix, curve_points);
    // Clamp negatives that spline interpolation can introduce
    for (let i = 0; i < smoothed.length; i++) {
      if (smoothed[i] < 0) smoothed[i] = 0;
    }
    smoothedLayers.push(smoothed);
    console.log('smoothed tl:', smoothed);
  }

  // ---- raw timeline attributes ----
  for (let t = 0; t < MAX_TIMELINES; t++) {
    const buf = new Float32Array(vertexCount);
    if (t < numTimelines) {
      const layer = smoothedLayers[t];
      for (let v = 0; v < vertexCount; v++) {
        buf[v] = layer[v] ?? 0;
      }
    }
    geo.setAttribute(`timeline${t}`, new THREE.Float32BufferAttribute(buf, 1));
  }

  // ---- cumulative band boundaries in LOG-SCALED world Y ----
  // Built from smoothed layer data so boundaries are as smooth
  // as the geometry itself
  for (let t = 0; t < MAX_TIMELINES; t++) {
    const buf = new Float32Array(vertexCount);
    if (t < numTimelines) {
      for (let v = 0; v < vertexCount; v++) {
        let cumSum = 0;
        for (let k = 0; k <= t; k++) {
          cumSum += smoothedLayers[k]?.[v] ?? 0;
        }
        buf[v] = cumSum > 0 ? Math.log(cumSum + 1) * 15 : 0;
      }
    }
    geo.setAttribute(`band${t}`, new THREE.Float32BufferAttribute(buf, 1));
  }

  geo.setAttribute('heightBuffer', new THREE.Float32BufferAttribute(heights, 1));

  geo.userData.numTimelines = numTimelines;
  geo.userData.maxHeight = maxHeight;
  geo.userData.minHeight = minHeight;
  geo.userData.maxTimelines = MAX_TIMELINES;

  return geo;
}





// generates mesh from height maps
function getSmoothArray(hmap, curve_points) {
    //console.log("hfuckingmap:", hmap);
    var splines2 = get_z_splines(hmap, curve_points);
    //console.log('splines 2:', splines2);
    var hArray = getHeightArray(splines2, curve_points);
    return hArray;
}

export function heightArrayToSmoothMatrix(heightArray) {
    //console.log('height array:', heightArray);
    const gridSize = Math.sqrt(heightArray.length);
    const matrix = [];
    
    for (let row = 0; row < gridSize; row++) {
        const rowVectors = [];
        for (let col = 0; col < gridSize; col++) {
            const index = row * gridSize + col;
            const height = heightArray[index] > 0 ? Math.log(heightArray[index] + 1) * 15 : 0;
            // Vector2(x_position, height_value)
            rowVectors.push(new THREE.Vector2(col, height));
        }
        matrix.push(rowVectors);
    }
    
    return matrix;
}

//generate array of splines from h_matrix of vec2s
export function get_x_splines(hMap){
    //console.log("MAPPY:", hMap.length);
    try{
        let splines = [];
        let len = hMap.length;
    
        for(let i=0; i<len; i++){
            splines.push(new THREE.SplineCurve(hMap[i]));
        }
        return splines;
    } catch (error) {
        console.error(error);
      }
}

//generate array of splines from h_matrix of vec2s
export function get_z_splines(hMap, curve_points=64){
    //console.log("Hmap: ", hMap);
    var xSplines = get_x_splines(hMap);
    var zSplines = [];
    const long_lines = [];
    var temp = [];
    var temp2 = [];
    var temp3 = [];
    try{
        for(var x=0; x<xSplines.length; x++){
            var points_n = xSplines[x].getPoints( curve_points-1 );
            long_lines.push(points_n);
        }

        for(var b=0;  b<long_lines[0].length; b++) {
            for(var a=0;  a<xSplines.length; a++){
               temp.push(new THREE.Vector2( a,long_lines[a][b].y ));
            }

            zSplines.push(new THREE.SplineCurve(temp));
            temp = [];
        }
        return zSplines;
        
    } catch (error) {
        console.log(error);
      }
}

export function getHeightArray(splines, curve_points){
    const heightArray = new Array(curve_points * curve_points);
    
    // Iterate through each spline (column)
    for(var col = 0; col < splines.length; col++){
        var points = splines[col].getPoints(curve_points - 1);
        
        // For each point in this column
        for(var row = 0; row < points.length; row++){
            // Write to row-major position: row * width + col
            const index = row * curve_points + col;
            if(points[row].y < 0){
                points[row].y = 0;
            }
            heightArray[index] = points[row].y;
        }
    }
    
    return heightArray;
}


export function handleCurves(curveArray, curve_points, dimension){
    var heightArray2 = new Array();
    for(let a=0; a<curveArray.length; a++){
        const points = curveArray[a].getPoints( curve_points );
        for(var i=0; i<points.length; i++){
            heightArray2.push(points[i].y);
        }
    }
    //console.log("points:", heightArray2.length);
    return heightArray2;
}


function setTimelineAttributes(geo, aggregatedEvents, vertexCount, MAX_TIMELINES, numTimelines) {
  const dataSize = aggregatedEvents.length;         // e.g. 32*32 = 1024
  const dataRow  = Math.sqrt(dataSize);            // 32

  const vertexRowSize = Math.sqrt(vertexCount);    // e.g. 96
  const kernelSize    = 3;                         // up-res factor
  // assume vertexRowSize === dataRow * kernelSize

  // --- TIMELINES (no overlap, 3x3 tiles) ---
  for (let t = 0; t < MAX_TIMELINES; t++) {
    const buf = new Float32Array(vertexCount);

    if (t < numTimelines) {
      for (let j = 0; j < dataRow; j++) {
        for (let i = 0; i < dataRow; i++) {
          const dPos = j * dataRow + i;
          const data = aggregatedEvents[dPos][t + 1]; // timeline value

          const baseY = j * kernelSize;
          const baseX = i * kernelSize;

          for (let dy = 0; dy < kernelSize; dy++) {
            for (let dx = 0; dx < kernelSize; dx++) {
              const ny = baseY + dy;
              const nx = baseX + dx;
              const pos = ny * vertexRowSize + nx;
              buf[pos] = data;
            }
          }
        }
      }
    }

    geo.setAttribute(
      `timeline${t}`,
      new THREE.Float32BufferAttribute(buf, 1),
    );
  }

  // --- YEARS (same tiling, so they align with timelines) ---
  const yuf = new Float32Array(vertexCount);

  for (let j = 0; j < dataRow; j++) {
    for (let i = 0; i < dataRow; i++) {
      const dPos = j * dataRow + i;
      const year = aggregatedEvents[dPos][0];

      const baseY = j * kernelSize;
      const baseX = i * kernelSize;

      for (let dy = 0; dy < kernelSize; dy++) {
        for (let dx = 0; dx < kernelSize; dx++) {
          const ny = baseY + dy;
          const nx = baseX + dx;
          const pos = ny * vertexRowSize + nx;
          yuf[pos] = year;
        }
      }
    }
  }

  geo.setAttribute('years', new THREE.Float32BufferAttribute(yuf, 1));

  return geo;
}





// smoothed version of updatePlane11 using spline up-res
// High‑res, smoothed version of updatePlane11
export function updatePlane11Smooth(
  geo,
  aggregatedEvents,
  resolution,              // e.g. 64; must match √vertexCount
) {
  const MAX_TIMELINES = 16;
  const posAttr     = geo.attributes.position;
  const vertexCount = posAttr.count;
  const positions   = posAttr.array;
  
  ///////////////////////////////////////////////////////////////
  ///---------- FAILURE CASE ----------//////////////////////////
  ///////////////////////////////////////////////////////////////
  if (!aggregatedEvents || aggregatedEvents.length === 0) {
    let g = handleFailure(geo, MAX_TIMELINES);
    return g;
  }
  ///////////////////////////////////////////////////////////////


  const gridSizeData = Math.sqrt(aggregatedEvents.length); // e.g. 32
  const gridSizeGeo  = resolution;                       // e.g. 64


  let numTimelines = aggregatedEvents[0].length - 1;
  if (numTimelines > MAX_TIMELINES) numTimelines = MAX_TIMELINES;

  //////////// HEIGHT SOURCING ///////////////////////////////////////////
  const heightArray = aggregatedEventsToHeightArray(aggregatedEvents);
  const hMatrix     = heightArrayToSmoothMatrix(heightArray);
  const smoothHeightArray = getSmoothArray(hMatrix, gridSizeGeo); // G×G


  // VERIFY DATA FITS ////////////////////////////////////////////////////
  if (smoothHeightArray.length !== vertexCount) {
    console.error(
      'Geometry vertex count does not match smoothed grid:',
      'vertexCount=', vertexCount,
      'smoothHeightArray=', smoothHeightArray.length,
    );
    return geo;
  }

  //// CREATE HEIGHT AND YEAR ARRAYS ////////////////////////////////////////////////
  const heights = new Float32Array(vertexCount);

  let maxHeight = -Infinity;
  let minHeight = Infinity;

  for(let x=0; x< smoothHeightArray.length; x++){
    heights[x] = smoothHeightArray[x];
    if (smoothHeightArray[x] > maxHeight) maxHeight = smoothHeightArray[x];
    if (smoothHeightArray[x] < minHeight) minHeight = smoothHeightArray[x];
    const p = x * 3;
    positions[p + 1] = smoothHeightArray[x]; // deform Y  
  }
  
  posAttr.needsUpdate = true;
  geo.computeVertexNormals();

  // ---------- SHADER BUFFERS ----------
  geo.setAttribute(
    'heightBuffer',
    new THREE.Float32BufferAttribute(heights, 1),
  );

  geo.userData.numTimelines  = numTimelines;
  geo.userData.maxHeight     = maxHeight;
  geo.userData.minHeight     = minHeight;
  geo.userData.maxTimelines  = MAX_TIMELINES;
  
  geo = setTimelineAttributes(geo, aggregatedEvents, vertexCount, MAX_TIMELINES, numTimelines);
  console.log("SMOOTH UPDATED PLANE REBUILT", geo);
  return geo;

}




























