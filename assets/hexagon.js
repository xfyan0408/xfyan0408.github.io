(() => {
  "use strict";

  const hosts = [...document.querySelectorAll("[data-hexagon]")];
  if (!hosts.length) return;

  const ns = "http://www.w3.org/2000/svg";
  const depth = 0.11;
  const outer = [[-0.5, 0.866], [-1, 0], [-0.5, -0.866],
    [0.5, -0.866], [1, 0], [0.5, 0.866]];
  const inner = outer.map(([x, y]) => [x * 0.78, y * 0.78]);
  const outline = [...outer, ...inner.slice().reverse()];
  const faces = [];
  const at = ([x, y], z) => [x, y, z];
  const normalize = (v) => {
    const length = Math.hypot(...v);
    return v.map((value) => value / length);
  };

  function addFace(vertices) {
    const a = vertices[1].map((v, i) => v - vertices[0][i]);
    const b = vertices[2].map((v, i) => v - vertices[0][i]);
    const normal = normalize([
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ]);
    faces.push({ vertices, normal });
  }

  // Five joined strips: the sixth (bottom) edge is intentionally absent.
  for (let i = 0; i < outer.length - 1; i += 1) {
    const strip = [outer[i], outer[i + 1], inner[i + 1], inner[i]];
    addFace(strip.map((point) => at(point, depth)));
    addFace(strip.slice().reverse().map((point) => at(point, -depth)));
  }
  // Follow the open outline, including a cap at each lower endpoint.
  outline.forEach((point, i) => {
    const next = outline[(i + 1) % outline.length];
    addFace([at(point, depth), at(point, -depth),
      at(next, -depth), at(next, depth)]);
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

  const tilt = 12 * Math.PI / 180;
  const light = normalize([-0.4, -0.65, 1]);
  const camera = 4.4;
  const initialAngle = 20 * Math.PI / 180;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let elapsed = 0;
  let previous = null;
  let frame = null;

  function render(angle) {
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
      const shade = Math.round(34 + diffuse * 35);
      const points = vertices.map(([vx, vy, vz]) => {
        const scale = 36 * camera / (camera - vz);
        return `${(50 + vx * scale).toFixed(2)},${(50 + vy * scale).toFixed(2)}`;
      }).join(" ");
      return { index, points, shade, z: vertices.reduce((sum, v) => sum + v[2], 0) / 4 };
    }).filter(Boolean).sort((a, b) => a.z - b.z);

    marks.forEach(({ svg, polygons }) => {
      svg.replaceChildren(...visible.map(({ index, points, shade }) => {
        const polygon = polygons[index];
        const color = `rgb(${shade}, ${shade + 1}, ${shade + 2})`;
        polygon.setAttribute("points", points);
        polygon.setAttribute("fill", color);
        polygon.setAttribute("stroke", color);
        polygon.setAttribute("stroke-width", "0.25");
        polygon.setAttribute("stroke-linejoin", "round");
        return polygon;
      }));
    });
  }

  function animate(now) {
    if (previous !== null) elapsed += now - previous;
    previous = now;
    render(initialAngle + elapsed * Math.PI * 2 / 14000);
    frame = requestAnimationFrame(animate);
  }

  function syncMotion() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    previous = null;
    render(motion.matches ? initialAngle : initialAngle + elapsed * Math.PI * 2 / 14000);
    if (!motion.matches && !document.hidden) frame = requestAnimationFrame(animate);
  }

  document.addEventListener("visibilitychange", syncMotion);
  motion.addEventListener("change", syncMotion);
  syncMotion();
})();
