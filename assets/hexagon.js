(() => {
  "use strict";

  const hosts = [...document.querySelectorAll("[data-hexagon]")];
  if (!hosts.length) return;

  const ns = "http://www.w3.org/2000/svg";
  const depth = 0.095;
  const bevel = 0.008;
  const altitude = Math.sqrt(3) / 2;
  const outer = [[-0.5, altitude], [-1, 0], [-0.5, -altitude],
    [0.5, -altitude], [1, 0], [0.5, altitude]];
  const inner = outer.map(([x, y]) => [x * 0.8, y * 0.8]);
  // Cut the two ends perpendicular to their sides instead of leaving acute tips.
  const halfWidth = 0.1 * altitude;
  [0, outer.length - 1].forEach((index) => {
    const center = outer[index].map((value, axis) => (value + inner[index][axis]) / 2);
    const offset = [(index === 0 ? -1 : 1) * halfWidth * altitude, halfWidth / 2];
    outer[index] = center.map((value, axis) => value + offset[axis]);
    inner[index] = center.map((value, axis) => value - offset[axis]);
  });
  const corners = [...outer, ...inner.slice().reverse()];
  // Small rounded corners preserve the straight sides and the open bottom edge.
  const outline = corners.flatMap((point, i) => {
    const before = corners[(i + corners.length - 1) % corners.length];
    const after = corners[(i + 1) % corners.length];
    const beforeLength = Math.hypot(...before.map((value, axis) => value - point[axis]));
    const afterLength = Math.hypot(...after.map((value, axis) => value - point[axis]));
    const trim = Math.min(0.09, beforeLength * 0.42, afterLength * 0.42);
    const start = point.map((value, axis) => value + (before[axis] - value) * trim / beforeLength);
    const end = point.map((value, axis) => value + (after[axis] - value) * trim / afterLength);
    return Array.from({ length: 5 }, (_, step) => {
      const t = step / 4;
      return point.map((value, axis) => (1 - t) ** 2 * start[axis] +
        2 * (1 - t) * t * value + t ** 2 * end[axis]);
    });
  });
  const faces = [];
  const at = ([x, y], z) => [x, y, z];
  const normalize = (v) => {
    const length = Math.hypot(...v);
    return v.map((value) => value / length);
  };

  function addFace(vertices, capNormal = null) {
    const a = vertices[1].map((v, i) => v - vertices[0][i]);
    const b = vertices[2].map((v, i) => v - vertices[0][i]);
    const normal = capNormal || normalize([
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ]);
    faces.push({ vertices, normal, cap: capNormal ? 1 : 0 });
  }

  // Offset each edge by the same distance, including the two open end caps.
  const inset = outline.map((point, i) => {
    const previous = outline[(i + outline.length - 1) % outline.length];
    const next = outline[(i + 1) % outline.length];
    const before = normalize([previous[1] - point[1], point[0] - previous[0]]);
    const after = normalize([point[1] - next[1], next[0] - point[0]]);
    const scale = bevel / (1 + before[0] * after[0] + before[1] * after[1]);
    return point.map((value, axis) => value + (before[axis] + after[axis]) * scale);
  });
  // One continuous face avoids visible seams between the five sides.
  addFace(inset.map((point) => at(point, depth)), [0, 0, 1]);
  addFace(inset.slice().reverse().map((point) => at(point, -depth)), [0, 0, -1]);
  // Follow the open outline, including a cap at each lower endpoint.
  outline.forEach((point, i) => {
    const j = (i + 1) % outline.length;
    const next = outline[j];
    const shoulder = depth - bevel;
    addFace([at(point, shoulder), at(point, -shoulder),
      at(next, -shoulder), at(next, shoulder)]);
    addFace([at(point, shoulder), at(next, shoulder),
      at(inset[j], depth), at(inset[i], depth)]);
    addFace([at(next, -shoulder), at(point, -shoulder),
      at(inset[i], -depth), at(inset[j], -depth)]);
  });

  const marks = hosts.map((host) => {
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.classList.add("site-mark-model");
    const polygons = faces.map(() => document.createElementNS(ns, "polygon"));
    host.replaceChildren(svg);
    return { svg, polygons };
  });

  const radians = Math.PI / 180;
  const light = normalize([-0.4, -0.65, 1]);
  const camera = 4.4;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let elapsed = 0;
  let previous = null;
  let frame = null;

  function render(time) {
    // A 2:3 Lissajous rhythm in orientation space, repeating every 48 seconds.
    // Bounded angles keep the open hexagon legible throughout the motion.
    const phase = time * Math.PI * 2 / 48000;
    const angle = (8 + 28 * Math.sin(2 * phase + Math.PI / 6)) * radians;
    const tilt = (12 + 8 * Math.cos(3 * phase)) * radians;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const rotate = ([x, y, z]) => {
      const turnedX = x * cosine + z * sine;
      const turnedZ = -x * sine + z * cosine;
      return [turnedX, y * Math.cos(tilt) - turnedZ * Math.sin(tilt),
        y * Math.sin(tilt) + turnedZ * Math.cos(tilt)];
    };
    const visible = faces.map((face, index) => {
      const vertices = face.vertices.map(rotate);
      const normal = rotate(face.normal);
      const [x, y, z] = vertices[0];
      if (-normal[0] * x - normal[1] * y + normal[2] * (camera - z) <= 0) {
        return null;
      }
      const diffuse = Math.max(0, normal.reduce((sum, v, i) => sum + v * light[i], 0));
      const shade = Math.round(28 + diffuse * 40);
      const points = vertices.map(([vx, vy, vz]) => {
        const scale = 36 * camera / (camera - vz);
        return `${(50 + vx * scale).toFixed(2)},${(50 + vy * scale).toFixed(2)}`;
      }).join(" ");
      return { index, points, shade, cap: face.cap,
        z: vertices.reduce((sum, v) => sum + v[2], 0) / vertices.length };
    // Our bounded angles always show the front: draw its continuous surface last.
    }).filter(Boolean).sort((a, b) => a.cap - b.cap || a.z - b.z);

    marks.forEach(({ svg, polygons }) => {
      svg.replaceChildren(...visible.map(({ index, points, shade }) => {
        const polygon = polygons[index];
        const color = `rgb(${shade}, ${shade}, ${shade})`;
        polygon.setAttribute("points", points);
        polygon.setAttribute("fill", color);
        polygon.setAttribute("stroke", color);
        polygon.setAttribute("stroke-width", "0.12");
        polygon.setAttribute("stroke-linejoin", "round");
        return polygon;
      }));
    });
  }

  function animate(now) {
    if (previous !== null) elapsed += now - previous;
    previous = now;
    render(elapsed);
    frame = requestAnimationFrame(animate);
  }

  function syncMotion() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    previous = null;
    render(motion.matches ? 0 : elapsed);
    if (!motion.matches && !document.hidden) frame = requestAnimationFrame(animate);
  }

  document.addEventListener("visibilitychange", syncMotion);
  motion.addEventListener("change", syncMotion);
  syncMotion();
})();
