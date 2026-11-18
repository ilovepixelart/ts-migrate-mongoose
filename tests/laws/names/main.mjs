function word_to_u32(w) {
  let x = 0;
  for (let i = 0; w.$ === "WCon"; i++) {
    x |= Number(w.head) << i;
    w = w.tail;
  }
  return x >>> 0;
}

function u32_to_word(x) {
  let w = {$: "WNil"};
  for (let i = 31; i >= 0; i--) {
    w = {$: "WCon", head: ((x >>> i) & 1) === 1, tail: w};
  }
  return w;
}

function cmp_new(a, b) {
  return {$: a < b ? "LT" : a === b ? "EQ" : "GT"};
}

function tup_new(a, b) {
  return {$: "Tuple", fst: a, snd: b};
}

function nat_divmod(a, b) {
  return tup_new(b && Math.trunc(a / b), b ? a % b : a);
}

function nat_chk(n) {
  if (n > 281474976710655) {
    throw "bend: a Nat past the largest immediate 2^48-1";
  }
  return n;
}

function nat_in(n) {
  if (!Number.isInteger(n) || n < 0 || n > 2 ** 53) {
    throw "bend: expected a Nat host number: an integer from 0 to 2^53";
  }
  return n;
}

function f32_show(x) {
  let s = "nan";
  for (let p = 1; x === x && p <= 9 && f32_round(s) !== x; p += 1) {
    s = String(Number(x.toExponential(p - 1)));
  }
  return (Object.is(x, -0) ? "-0" : s).replace("Infinity", "inf");
}

function f32_bits(x) {
  return new Uint32Array(new Float32Array([x]).buffer)[0];
}

function f32_from_bits(u) {
  return new Float32Array(new Uint32Array([u]).buffer)[0];
}

function f32_read(s) {
  const re = /^[\t\n\v\f\r ]*[+-]?((\d+(?:\.\d*)?|\.\d+)(e[+-]?\d+)?|inf(inity)?|nan)$/i;
  return re.test(s) ? {$: "Some", value: f32_round(
    s.replace(/inf\w*/i, "Infinity"))} : {$: "None"};
}

const f32_round = function f32_round(s) {
  const d = Number(s);
  const a = Math.abs(d);
  const f = Math.fround(a);
  const g = 2 * a - Math.min(f, 2 ** 128);
  if (g === f || Math.fround(g) !== g || g === Infinity) {
    return Math.sign(d) * f;
  }
  let k = 0;
  while (a * 2 ** k % 1 !== 0) {
    k += 1;
  }
  const [, i, r, e] = /(\d*)\.?(\d*)(?:e([+-]?\d+))?$/i.exec(s);
  const n = Number(e ?? 0) - r.length;
  const x = BigInt(i + r) * 2n ** BigInt(k) * 10n ** BigInt(Math.max(n, 0));
  const y = BigInt(a * 2 ** k) * 10n ** BigInt(Math.max(-n, 0));
  return Math.sign(d) * (x === y || x > y !== g > f ? f : g);
};

const char_new = function char_new(c) {
  return c < 55296 || c >= 57344 && c <= 1114111 ? String.fromCodePoint(c) : String.fromCharCode(56320, c >>> 22, c >>> 11 & 2047, c & 2047);
};

function char_len(s, at = 0) {
  return s[at] === "\uDC00" ? 4 : s.codePointAt(at) > 0xFFFF ? 2 : 1;
}

function char_code(s) {
  return s.length < 4 ? s.codePointAt(0)
    : (s.charCodeAt(1) << 22 | s.charCodeAt(2) << 11 | s.charCodeAt(3)) >>> 0;
}

function string_contains(s, p) {
  // A match starts at a Char, not inside a packed U32 code.
  for (let at = 0; at <= s.length; at += char_len(s, at)) {
    if (s.startsWith(p, at)) {
      return true;
    }
  }
  return false;
}

function str_out(s) {
  return s.replace(/\uDC00[^]{3}/gu, "\uFFFD");
}

function str_in(s) {
  return s.replace(/\p{Cs}/gu, "\uFFFD");
}

// Array
// =====

function array_new(d, v, lgs) {
  if (d > 31 - lgs) {
    throw "bend: an array past the deepest block class 31 (depth + log2 words per cell)";
  }
  return Array(2 ** d).fill(v);
}

function array_node(a, b) {
  if (a.length !== b.length) {
    throw "bend: runtime fail-stop";
  }
  return a.concat(b);
}

function array_rmw(a, i, f) {
  const old = a[i %= a.length];
  a[i] = f(old);
  return tup_new(a, old);
}

// Run
// ===

function run_tail(f, x) {
  return {$: "$JMP", f: f.j?.f === f ? f.j : f, x};
}

function run_clo(j) {
  const f = (x) => run_loop(j(x));
  f.j = j;
  j.f = f;
  return f;
}

function run_loop(r) {
  while (r !== null && typeof r === "object" && r.$ === "$JMP") {
    r = r.f(r.x);
  }
  return r;
}

function run_lib(f, n) {
  return (...a) => a.length < n ? run_lib((...b) => f(...a, ...b), n - a.length)
    : run_loop(f(...a));
}

// Effect
// ======

const $0eff = Object.create(null);
const io_file_append = new Set();

function io_eff(k, run) {
  if (arguments.length > 2) {
    throw new Error("bend: " + k + " takes no need: an effect that waits parks itself");
  }
  if (k in $0eff) {
    throw new Error("bend: two effects register " + k);
  }
  $0eff[k] = run;
}
// Program
// =======

function $SPEC_is_code(_c_0, _k_0) {
  const _x_0 = $$Char_to_u32(_c_0);
  return (_x_0 === _k_0);
}

function $SPEC_is_dot(_c_0) {
  return $SPEC_is_code(_c_0, 46);
}

function $SPEC_is_slash(_c_0) {
  const _x_0 = $$SPEC_is_code(_c_0, 47);
  const _x_1 = $$SPEC_is_code(_c_0, 92);
  return (_x_0 || _x_1);
}

function $SPEC_whitelisted(_c_0) {
  const _x_0 = $$Char_is_alpha(_c_0);
  const _x_1 = $$Char_is_digit(_c_0);
  const _x_2 = (_x_0 || _x_1);
  const _x_3 = $$SPEC_is_code(_c_0, 46);
  const _x_4 = (_x_2 || _x_3);
  const _x_5 = $$SPEC_is_code(_c_0, 95);
  const _x_6 = (_x_4 || _x_5);
  const _x_7 = $$SPEC_is_code(_c_0, 45);
  return (_x_6 || _x_7);
}

function $SPEC_allowed(_c_0) {
  return $Bool_and($$Bool_not($$SPEC_is_slash(_c_0)), $$SPEC_whitelisted(_c_0));
}

function $SPEC_all_allowed(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    return $Bool_and($$SPEC_allowed(_h_0), $$SPEC_all_allowed(_t_0));
  }
}

function $SPEC_has_double_dot(_s_0, _prev_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    const _x_0 = $$Bool_and($$SPEC_is_dot(_h_0), _prev_0);
    const _x_1 = $$SPEC_has_double_dot(_t_0, $$SPEC_is_dot(_h_0));
    return (_x_0 || _x_1);
  }
}

function $SPEC_has_slash(_s_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    const _x_0 = $$SPEC_is_slash(_h_0);
    const _x_1 = $$SPEC_has_slash(_t_0);
    return (_x_0 || _x_1);
  }
}

function $SPEC_valid(_s_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    return $Bool_and($$SPEC_all_allowed((_h_0 + _t_0)), $$Bool_not($$SPEC_has_double_dot((_h_0 + _t_0), false)));
  }
}

function $char_ok(_d_0, _sl_0, _w_0, _prev_0) {
  if (_d_0) {
    if (_prev_0) {
      return false;
    } else {
      return $Bool_and($$Bool_not(_sl_0), _w_0);
    }
  } else {
    return $Bool_and($$Bool_not(_sl_0), _w_0);
  }
}

function $rest_ok(_s_0, _prev_0) {
  if (_s_0 === "") {
    return true;
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    return $Bool_and($$char_ok($$SPEC_is_dot(_h_0), $$SPEC_is_slash(_h_0), $$SPEC_whitelisted(_h_0), _prev_0), $$rest_ok(_t_0, $$SPEC_is_dot(_h_0)));
  }
}

function $valid(_s_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    return $rest_ok((_h_0 + _t_0), false);
  }
}

function $Char_to_u32(_c_0) {
  const _x_0 = char_code(_c_0);
  return _x_0;
}

function $Char_is_alpha(_c_0) {
  const _x_0 = $$Char_is_upper(_c_0);
  const _x_1 = $$Char_is_lower(_c_0);
  return (_x_0 || _x_1);
}

function $Char_is_digit(_c_0) {
  const _x_0 = char_code(_c_0);
  return $Bool_and((_x_0 >= 48), (_x_0 <= 57));
}

function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}

function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}

function $Char_is_upper(_c_0) {
  const _x_0 = char_code(_c_0);
  return $Bool_and((_x_0 >= 65), (_x_0 <= 90));
}

function $Char_is_lower(_c_0) {
  const _x_0 = char_code(_c_0);
  return $Bool_and((_x_0 >= 97), (_x_0 <= 122));
}

const $$Char_to_u32 = $Char_to_u32;
const $$SPEC_is_code = $SPEC_is_code;
const $$Char_is_alpha = $Char_is_alpha;
const $$Char_is_digit = $Char_is_digit;
const $$SPEC_is_slash = $SPEC_is_slash;
const $$Bool_not = $Bool_not;
const $$SPEC_whitelisted = $SPEC_whitelisted;
const $$SPEC_allowed = $SPEC_allowed;
const $$SPEC_all_allowed = $SPEC_all_allowed;
const $$SPEC_is_dot = $SPEC_is_dot;
const $$Bool_and = $Bool_and;
const $$SPEC_has_double_dot = $SPEC_has_double_dot;
const $$SPEC_has_slash = $SPEC_has_slash;
const $$char_ok = $char_ok;
const $$rest_ok = $rest_ok;
const $$Char_is_upper = $Char_is_upper;
const $$Char_is_lower = $Char_is_lower;export default {
  "SPEC:is_code": run_lib((a0,a1) => run_loop($SPEC_is_code(str_in(a0),a1)), 2),
  "SPEC:is_dot": run_lib((a0) => run_loop($SPEC_is_dot(str_in(a0))), 1),
  "SPEC:is_slash": run_lib((a0) => run_loop($SPEC_is_slash(str_in(a0))), 1),
  "SPEC:whitelisted": run_lib((a0) => run_loop($SPEC_whitelisted(str_in(a0))), 1),
  "SPEC:allowed": run_lib((a0) => run_loop($SPEC_allowed(str_in(a0))), 1),
  "SPEC:all_allowed": run_lib((a0) => run_loop($SPEC_all_allowed(str_in(a0))), 1),
  "SPEC:has_double_dot": run_lib((a0,a1) => run_loop($SPEC_has_double_dot(str_in(a0),a1)), 2),
  "SPEC:has_slash": run_lib((a0) => run_loop($SPEC_has_slash(str_in(a0))), 1),
  "SPEC:valid": run_lib((a0) => run_loop($SPEC_valid(str_in(a0))), 1),
  "char_ok": run_lib((a0,a1,a2,a3) => run_loop($char_ok(a0,a1,a2,a3)), 4),
  "rest_ok": run_lib((a0,a1) => run_loop($rest_ok(str_in(a0),a1)), 2),
  "valid": run_lib((a0) => run_loop($valid(str_in(a0))), 1),
};
