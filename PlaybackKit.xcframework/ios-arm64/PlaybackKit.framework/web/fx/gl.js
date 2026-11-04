// A small WebGL2 toolkit: programs, render targets and full-screen passes.
//
// Every pass draws one oversized triangle that covers the viewport; there are no
// vertex buffers at all (the vertex shader derives positions from gl_VertexID).

export const VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID & 1) << 2) - 1.0, float((gl_VertexID & 2) << 1) - 1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

export function createGL(canvas, attrs = {}) {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    // Off on purpose: every edge is anti-aliased in the shaders, by supersampling.
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'default',
    ...attrs,
  });
  if (!gl) return null;
  const vao = gl.createVertexArray();
  // Half-float targets need this to be renderable. Without it they fall back to 8 bits.
  const canFloat = !!gl.getExtension('EXT_color_buffer_float');

  /**
   * `vs` replaces the full-screen triangle's vertex shader, for passes with geometry.
   *
   * Compiled and linked here, but checked when first used (`ready`): asking a program
   * whether it linked makes the page wait for the GPU to finish compiling it, and a WebView
   * compiles in its GPU process, so the session's programs, all made up front, would hold
   * the page up at start for the ones not drawn until much later (Wave, Thermal).
   */
  function program(fs, label, vs = VS) {
    const shaders = [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].map(([type, src]) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    });
    const p = gl.createProgram();
    for (const s of shaders) gl.attachShader(p, s);
    gl.linkProgram(p);
    let checked = false;
    const ready = () => {
      if (checked) return;
      checked = true;
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
        const bad = shaders.find((s) => !gl.getShaderParameter(s, gl.COMPILE_STATUS));
        throw new Error(`${label}: ${bad ? gl.getShaderInfoLog(bad) : gl.getProgramInfoLog(p)}`);
      }
    };
    // Uniform locations never change after linking: look each up once.
    const locs = new Map();
    const loc = (name) => {
      if (!locs.has(name)) {
        ready();
        locs.set(name, gl.getUniformLocation(p, name));
      }
      return locs.get(name);
    };
    return { p, loc, ready };
  }

  /**
   * A texture-backed render target. `levels` > 1 allocates a mip chain; `float` asks for
   * 16 bits per channel where the device can render to it (smooth gradients that get
   * stretched band at 8).
   */
  function target(w, h, { levels = 1, float = false } = {}) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, levels, float && canFloat ? gl.RGBA16F : gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, levels > 1 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {
      tex, fbo, w, h, levels,
      dispose() { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); },
    };
  }

  /** A plain texture for uploads (canvas rasters, ramps). */
  function texture({ wrap = gl.CLAMP_TO_EDGE } = {}) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    return tex;
  }

  /**
   * Upload a 2D canvas. Stored bottom-up like every render target, so one convention
   * (flip v when going from canvas pixels to uv) covers every texture in the pipeline.
   */
  function upload(tex, source) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  /**
   * Draw one full-screen pass. `to` is a target or null (the canvas); `blend` composites
   * premultiplied colour over what is there, otherwise the target is overwritten.
   * `scissor: [x, y, w, h]` (GL pixels, from the bottom left) leaves the rest untouched:
   * for a pass that draws nothing outside that rectangle, so only it is shaded.
   */
  function pass(prog, to, setup, { blend = false, viewport, scissor } = {}) {
    prog.ready();
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.fbo : null);
    const [w, h] = viewport || (to ? [to.w, to.h] : [gl.drawingBufferWidth, gl.drawingBufferHeight]);
    gl.viewport(0, 0, w, h);
    if (scissor) {
      if (scissor[2] < 1 || scissor[3] < 1) return;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(...scissor);
    }
    if (blend) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.disable(gl.BLEND);
    }
    let unit = 0;
    const bind = (name, tex) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(prog.loc(name), unit++);
    };
    setup(prog.loc, bind);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    if (scissor) gl.disable(gl.SCISSOR_TEST);
  }

  return { gl, program, target, texture, upload, pass };
}
