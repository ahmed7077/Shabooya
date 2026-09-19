/** Image-only geometry. No institution, subject or sample-specific coordinates. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
/** Reject empty cells and long rule fragments before OCR can hallucinate text. */
export function hasCellText(raster: Raster, rect: Rect) {
  const w = Math.floor(rect.width),
    h = Math.floor(rect.height),
    pixels = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i =
        ((Math.floor(rect.y) + y) * raster.width + Math.floor(rect.x) + x) * 4;
      pixels[y * w + x] = raster.data[i] < 125 ? 1 : 0;
    }
  let letters = 0,
    total = 0;
  for (let i = 0; i < pixels.length; i++) {
    if (!pixels[i]) continue;
    pixels[i] = 0;
    const stack = [i];
    let count = 0,
      left = w,
      right = 0,
      top = h,
      bottom = 0;
    while (stack.length) {
      const p = stack.pop()!,
        x = p % w,
        y = Math.floor(p / w);
      count++;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
      ]) {
        const nx = x + dx,
          ny = y + dy,
          n = ny * w + nx;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && pixels[n]) {
          pixels[n] = 0;
          stack.push(n);
        }
      }
    }
    const cw = right - left + 1,
      ch = bottom - top + 1;
    if (ch >= 4 && cw >= 2 && count >= 5 && cw / ch < 9 && ch / cw < 12) {
      letters++;
      total += count;
    }
  }
  return letters >= 2 && total >= 20;
}
interface Segment {
  axis: number;
  from: number;
  to: number;
}
export function detectGrid(image: Raster) {
  const { width: w, height: h, data } = image;
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < ink.length; i++)
    ink[i] =
      Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) < 165 ? 1 : 0;
  // Hough-style horizontal projection also tolerates camera roll in photographs.
  let slope = 0,
    best = 0;
  for (let step = -20; step <= 20; step++) {
    const s = step / 400,
      counts = new Uint32Array(h);
    for (let x = Math.round(w * 0.12); x < w * 0.92; x += 2)
      for (let y = Math.round(h * 0.09); y < h * 0.91; y += 2) {
        if (!ink[y * w + x]) continue;
        const row = Math.round(y - s * (x - w / 2));
        if (row >= 0 && row < h) counts[row]++;
      }
    const score = Array.from(counts)
      .sort((a, b) => b - a)
      .slice(0, Math.max(8, Math.round(h * 0.018)))
      .reduce((a, b) => a + b * b, 0);
    if (score > best) {
      best = score;
      slope = s;
    }
  }
  const straight = new Uint8Array(w * h),
    rgba = new Uint8ClampedArray(w * h * 4),
    luminance = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sourceY = Math.round(y + slope * (x - w / 2)),
        sourceX = Math.round(x - slope * (y - h / 2));
      const value =
        sourceY >= 0 && sourceY < h && sourceX >= 0 && sourceX < w
          ? ink[sourceY * w + sourceX]
          : 0;
      straight[y * w + x] = value;
      const i = (y * w + x) * 4,
        source = (sourceY * w + sourceX) * 4;
      const gray =
        sourceY >= 0 && sourceY < h && sourceX >= 0 && sourceX < w
          ? Math.max(data[source], data[source + 1], data[source + 2])
          : 255;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = gray;
      rgba[i + 3] = 255;
      const lum =
        sourceY >= 0 && sourceY < h && sourceX >= 0 && sourceX < w
          ? Math.round(
              data[source] * 0.299 +
                data[source + 1] * 0.587 +
                data[source + 2] * 0.114,
            )
          : 255;
      luminance[i] = luminance[i + 1] = luminance[i + 2] = lum;
      luminance[i + 3] = 255;
    }
  function scan(vertical: boolean): Segment[] {
    const outer = vertical ? w : h,
      inner = vertical ? h : w,
      result: Segment[] = [];
    const minimum = vertical
      ? Math.max(28, h * 0.045)
      : Math.max(55, w * 0.075);
    for (let a = 0; a < outer; a++) {
      let start = -1,
        last = -1;
      for (let b = 0; b <= inner + 3; b++) {
        let on = false;
        if (b < inner)
          for (let delta = -2; delta <= 2; delta++) {
            const cross = a + delta;
            if (
              cross >= 0 &&
              cross < outer &&
              straight[vertical ? b * w + cross : cross * w + b]
            )
              on = true;
          }
        if (on) {
          if (start < 0) start = b;
          last = b;
        } else if (start >= 0 && b - last > 3) {
          if (last - start >= minimum)
            result.push({ axis: a, from: start, to: last });
          start = -1;
        }
      }
    }
    return result;
  }
  let horizontal = scan(false),
    vertical = scan(true);
  const major = horizontal.filter((l) => l.to - l.from > w * 0.6),
    bands: Segment[][] = [];
  for (const line of major) {
    const band = bands.at(-1);
    if (band && line.axis - band.at(-1)!.axis < 7) band.push(line);
    else bands.push([line]);
  }
  const borders = bands.filter((b) => b.at(-1)!.axis - b[0].axis < 14).flat();
  if (borders.length) {
    const top = Math.min(...borders.map((l) => l.axis)),
      bottom = Math.max(...borders.map((l) => l.axis)),
      left = Math.min(...borders.map((l) => l.from)),
      right = Math.max(...borders.map((l) => l.to));
    horizontal = horizontal.filter(
      (l) => l.axis >= top - 3 && l.axis <= bottom + 3,
    );
    vertical = vertical
      .map((l) => ({
        ...l,
        from: Math.max(l.from, top),
        to: Math.min(l.to, bottom),
      }))
      .filter(
        (l) => l.axis >= left - 3 && l.axis <= right + 3 && l.to - l.from >= 28,
      );
  }
  function clusters(lines: Segment[], limit: number) {
    const positions = [...new Set(lines.map((l) => l.axis))]
        .filter((x) => x > limit * 0.005 && x < limit * 0.995)
        .sort((a, b) => a - b),
      groups: number[][] = [];
    for (const x of positions) {
      const g = groups.at(-1);
      if (g && x - g.at(-1)! < 7) g.push(x);
      else groups.push([x]);
    }
    return groups.map((g) =>
      Math.round(g.reduce((a, b) => a + b, 0) / g.length),
    );
  }
  let xs = clusters(vertical, w),
    ys = clusters(horizontal, h);
  const covers = (lines: Segment[], axis: number, point: number) =>
    lines.some(
      (l) =>
        Math.abs(l.axis - axis) < 7 && l.from - 5 <= point && l.to + 5 >= point,
    );
  // A real grid boundary crosses several perpendicular boundaries; text strokes do not.
  xs = xs.filter(
    (x) =>
      ys.filter((y) => covers(vertical, x, y) && covers(horizontal, y, x))
        .length >= 3,
  );
  ys = ys.filter(
    (y) =>
      xs.filter((x) => covers(vertical, x, y) && covers(horizontal, y, x))
        .length >= 2,
  );
  if (xs.length < 3 || ys.length < 3 || xs.length > 35 || ys.length > 55)
    return {
      raster: { width: w, height: h, data: rgba },
      cells: [] as Rect[],
      slope,
    };
  const cells: Rect[] = [],
    seen = new Set<string>();
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      const key = `${i}:${j}`;
      if (seen.has(key)) continue;
      const queue = [[i, j]],
        points: number[][] = [];
      seen.add(key);
      while (queue.length) {
        const [a, b] = queue.pop()!;
        points.push([a, b]);
        for (const [c, d, closed] of [
          [a - 1, b, covers(vertical, xs[a], (ys[b] + ys[b + 1]) / 2)],
          [a + 1, b, covers(vertical, xs[a + 1], (ys[b] + ys[b + 1]) / 2)],
          [a, b - 1, covers(horizontal, ys[b], (xs[a] + xs[a + 1]) / 2)],
          [a, b + 1, covers(horizontal, ys[b + 1], (xs[a] + xs[a + 1]) / 2)],
        ] as [number, number, boolean][]) {
          const k = `${c}:${d}`;
          if (
            !closed &&
            c >= 0 &&
            d >= 0 &&
            c < xs.length - 1 &&
            d < ys.length - 1 &&
            !seen.has(k)
          ) {
            seen.add(k);
            queue.push([c, d]);
          }
        }
      }
      const left = Math.min(...points.map((p) => p[0])),
        right = Math.max(...points.map((p) => p[0])) + 1,
        top = Math.min(...points.map((p) => p[1])),
        bottom = Math.max(...points.map((p) => p[1])) + 1;
      if (points.length !== (right - left) * (bottom - top)) continue;
      if (xs[right] - xs[left] > 25 && ys[bottom] - ys[top] > 18)
        cells.push({
          x: xs[left],
          y: ys[top],
          width: xs[right] - xs[left],
          height: ys[bottom] - ys[top],
        });
    }
  const rowEdges = ys.filter((y) => covers(horizontal, y, (xs[1] + xs[2]) / 2));
  const expanded = cells.flatMap((c) => {
    if (c.x === xs[0] && c.height > (ys.at(-1)! - ys[0]) * 0.6)
      return rowEdges
        .filter((y) => y >= c.y && y < c.y + c.height)
        .map((y) => ({
          ...c,
          y,
          height: rowEdges[rowEdges.indexOf(y) + 1] - y,
        }));
    if (c.x > xs[0] && c.width > (xs.at(-1)! - xs[0]) * 0.7 && c.y <= ys[1])
      return xs
        .filter((x) => x >= c.x && x < c.x + c.width)
        .map((x) => ({ ...c, x, width: xs[xs.indexOf(x) + 1] - x }));
    return [c];
  });
  return {
    raster: { width: w, height: h, data: rgba },
    luminance: { width: w, height: h, data: luminance },
    cells: expanded,
    slope,
    xs,
    ys,
  };
}
