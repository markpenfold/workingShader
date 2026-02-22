import * as THREE from 'three/webgpu';

export function aggregatedEventsToHeightArray(aggregatedEvents) {
   // console.log("agg events in aggregatedEventsToHeightArray", aggregatedEvents);
    if (!aggregatedEvents || aggregatedEvents.length === 0) return [];

    const heightArray = aggregatedEvents.map(composition =>
        composition.slice(1).reduce((sum, val) => sum + val, 0)    );
    return heightArray;
}


export function updatePlane10(geo, aggregatedEvents, curve_points = 32) {
  const MAX_TIMELINES = 16;

  const posAttr = geo.attributes.position;
  const vertexCount = posAttr.count;

  // DEAL WITH FAILURE CASE /////////////////////////////////
  ///////////////////////////////////////////////////////////
  if (!aggregatedEvents || aggregatedEvents.length === 0) {
    geo.userData.numTimelines = 0;
    geo.userData.maxHeight = 0;
    geo.userData.minHeight = 0;

    const zeroBuf = new Float32Array(vertexCount);
    for (let t = 0; t < MAX_TIMELINES; t++) {
      geo.setAttribute(
        `timeline${t}`,
        new THREE.Float32BufferAttribute(zeroBuf, 1),
      );
    }
  
    return geo;
  }

  let numTimelines = aggregatedEvents[0].length;
  if (aggregatedEvents.length !== vertexCount) {
    console.warn('aggregatedEvents length must equal vertex count');
  }

  if (numTimelines > MAX_TIMELINES) {
    console.warn(
      `numTimelines (${numTimelines}) > MAX_TIMELINES (${MAX_TIMELINES}), truncating`,
    );
    numTimelines = MAX_TIMELINES;
  }

  // ---- smooth heights (your spline "blur") ----
  const heightArray = aggregatedEventsToHeightArray(aggregatedEvents);
  const positions = posAttr.array;
  const heights = new Float32Array(vertexCount);
  let maxHeight = -Infinity;
  let minHeight = Infinity;

  for (let i = 0; i < vertexCount; i++) {
    const h = heightArray[i] ?? 0;
    heights[i] = h;

    if (h > maxHeight) maxHeight = h;
    if (h < minHeight) minHeight = h;

    // deform geometry: y = height
    const idx = i * 3;
    positions[idx + 1] = h;
  }

  posAttr.needsUpdate = true;
  geo.computeVertexNormals();

  // ---- per‑timeline attributes (for banding shader) ----
  for (let t = 0; t < MAX_TIMELINES; t++) {
    const buf = new Float32Array(vertexCount);

    if (t < numTimelines) {
      for (let v = 0; v < vertexCount; v++) {
        const row = aggregatedEvents[v] || [];
        buf[v] = row[t] ?? 0;
      }
    } else {
      buf.fill(0);
    }

    geo.setAttribute(
      `timeline${t}`,
      new THREE.Float32BufferAttribute(buf, 1),
    );
  }

  // heightBuffer still used by shader for vHeight / banding
  geo.setAttribute(
    'heightBuffer',
    new THREE.Float32BufferAttribute(heights, 1),
  );

  geo.userData.numTimelines = numTimelines;
  geo.userData.maxHeight = maxHeight;
  geo.userData.minHeight = minHeight;
  geo.userData.maxTimelines = MAX_TIMELINES;

  return geo;
}





export function updatePlane9(geo, aggregatedEvents, curve_points = 64) {
  const MAX_TIMELINES = 16;

  if (!aggregatedEvents || aggregatedEvents.length === 0) {
    geo.userData.numTimelines = 0;
    geo.userData.maxHeight = 0;
    geo.userData.minHeight = 0;

    // still ensure attributes exist (all zero) so shader is happy
    const vertexCount = geo.attributes.position.count;
    const zeroBuf = new Float32Array(vertexCount);
    for (let t = 0; t < MAX_TIMELINES; t++) {
      geo.setAttribute(
        `timeline${t}`,
        new THREE.Float32BufferAttribute(zeroBuf, 1)
      );
    }
    geo.setAttribute(
      'heightBuffer',
      new THREE.Float32BufferAttribute(zeroBuf, 1)
    );
    return geo;
  }

  const vertexCount = geo.attributes.position.count;
  let numTimelines = aggregatedEvents[0].length;

  if (aggregatedEvents.length !== vertexCount) {
    console.warn('aggregatedEvents length must equal vertex count');
  }

  // clamp to MAX_TIMELINES so shader and geometry agree
  if (numTimelines > MAX_TIMELINES) {
    console.warn(
      `numTimelines (${numTimelines}) > MAX_TIMELINES (${MAX_TIMELINES}), truncating`
    );
    numTimelines = MAX_TIMELINES;
  }

  // heights
  const heightArray = aggregatedEventsToHeightArray(aggregatedEvents);
  const hMatrix = heightArrayToSmoothMatrix(heightArray);
  const smoothHeightArray = getSmoothArray(hMatrix, 32);

  const posAttr = geo.attributes.position;
  const positions = posAttr.array;

  const heights = new Float32Array(vertexCount);
  let maxHeight = -Infinity;
  let minHeight = Infinity;

  for (let i = 0; i < vertexCount; i++) {
    const h = smoothHeightArray[i] ?? 0;
    heights[i] = h;
    if (h > maxHeight) maxHeight = h;
    if (h < minHeight) minHeight = h;
    // keep geometry flat; deform in shader
    // const idx = i * 3;
    // positions[idx + 1] = h;
  }

  posAttr.needsUpdate = true;
  geo.computeVertexNormals();

  // per‑timeline attributes: always create timeline0..timeline15
  for (let t = 0; t < MAX_TIMELINES; t++) {
    const buf = new Float32Array(vertexCount);

    if (t < numTimelines) {
      // real data for used timelines
      for (let v = 0; v < vertexCount; v++) {
        const row = aggregatedEvents[v] || [];
        buf[v] = row[t] ?? 0;
      }
    } else {
      // unused timelines remain all zeros
      buf.fill(0);
    }

    geo.setAttribute(
      `timeline${t}`,
      new THREE.Float32BufferAttribute(buf, 1)
    );
  }

  // heightBuffer
  geo.setAttribute('heightBuffer', new THREE.Float32BufferAttribute(heights, 1));

  // vertexIndex if needed
  const indices = new Float32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) indices[i] = i;
  geo.setAttribute('vertexIndex', new THREE.Float32BufferAttribute(indices, 1));

  geo.userData.numTimelines = numTimelines;
  geo.userData.maxHeight = maxHeight;
  geo.userData.minHeight = minHeight;
  geo.userData.maxTimelines = MAX_TIMELINES;

  //console.log('✅ updatePlane9 buffers ready, mofo', geo);
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






























