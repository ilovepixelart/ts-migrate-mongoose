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

function $SPEC_keep(_b_0, _x_0, _rest_0) {
  if (_b_0) {
    return {$: "Con", "head": _x_0, "tail": _rest_0};
  } else {
    return _rest_0;
  }
}

function $SPEC_ids(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return {$: "Nil"};
  } else {
    const _t_0 = _xs_0["head"];
    const _id_0 = _t_0["id"];
    const _r_0 = _xs_0["tail"];
    return {$: "Con", "head": _id_0, "tail": $$SPEC_ids(_r_0)};
  }
}

function $SPEC_has_id(_xs_0, _id_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const _t_0 = _xs_0["head"];
    const _i_0 = _t_0["id"];
    const _r_0 = _xs_0["tail"];
    const _x_0 = $$Nat_is_eq(_i_0, _id_0);
    const _x_1 = $$SPEC_has_id(_r_0, _id_0);
    return (_x_0 || _x_1);
  }
}

function $SPEC_ordered_from(_xs_0, _lo_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = _xs_0["head"];
    const _t_1 = _t_0["t"];
    const _r_0 = _xs_0["tail"];
    return $Bool_and($$Nat_is_le(_lo_0, _t_1), $$SPEC_ordered_from(_r_0, _t_1));
  }
}

function $SPEC_ordered(_xs_0) {
  return $SPEC_ordered_from(_xs_0, 0);
}

function $SPEC_all_le_up(_xs_0, _c_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = _xs_0["head"];
    const _t_1 = _t_0["t"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    const _x_0 = $$Bool_not($$Nat_is_le(_t_1, _c_0));
    return $Bool_and((_x_0 || _u_0), $$SPEC_all_le_up(_r_0, _c_0));
  }
}

function $SPEC_all_ge_down(_xs_0, _c_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = _xs_0["head"];
    const _t_1 = _t_0["t"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    const _x_0 = $$Bool_not($$Nat_is_ge(_t_1, _c_0));
    const _x_1 = $$Bool_not(_u_0);
    return $Bool_and((_x_0 || _x_1), $$SPEC_all_ge_down(_r_0, _c_0));
  }
}

function $SPEC_all_up(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = _xs_0["head"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    return $Bool_and(_u_0, $$SPEC_all_up(_r_0));
  }
}

function $SPEC_all_down(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = _xs_0["head"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    return $Bool_and($$Bool_not(_u_0), $$SPEC_all_down(_r_0));
  }
}

function $SPEC_all_with_id(_xs_0, _id_0, _v_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = _xs_0["head"];
    const _i_0 = _t_0["id"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    const _x_0 = $$Bool_not($$Nat_is_eq(_i_0, _id_0));
    const _x_1 = $$Bool_not((_u_0 !== _v_0));
    return $Bool_and((_x_0 || _x_1), $$SPEC_all_with_id(_r_0, _id_0, _v_0));
  }
}

function $SPEC_changed(_xs_0, _ys_0) {
  if (_xs_0.$ === "Con") {
    const _t_0 = _xs_0["head"];
    const _id_0 = _t_0["id"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    if (_ys_0.$ === "Con") {
      const _t_2 = _ys_0["head"];
      const _v_0 = _t_2["up"];
      const _q_0 = _ys_0["tail"];
      return $SPEC_keep((_u_0 !== _v_0), _id_0, $$SPEC_changed(_r_0, _q_0));
    } else {
      return {$: "Nil"};
    }
  } else {
    return {$: "Nil"};
  }
}

function $SPEC_changed_latest_first($0, $1, $2) {
  for (;;) {
    {
      const _xs_0 = $0;
      const _ys_0 = $1;
      const _acc_0 = $2;
      if (_xs_0.$ === "Con") {
        const _t_0 = _xs_0["head"];
        const _id_0 = _t_0["id"];
        const _u_0 = _t_0["up"];
        const _r_0 = _xs_0["tail"];
        if (_ys_0.$ === "Con") {
          const _t_2 = _ys_0["head"];
          const _v_0 = _t_2["up"];
          const _q_0 = _ys_0["tail"];
          $0 = _r_0;
          $1 = _q_0;
          $2 = $$SPEC_keep((_u_0 !== _v_0), _id_0, _acc_0);
          continue;
        } else {
          return _acc_0;
        }
      } else {
        return _acc_0;
      }
    }
  }
}

function $SPEC_frame_gt(_xs_0, _ys_0, _c_0) {
  if (_xs_0.$ === "Con") {
    const _t_0 = _xs_0["head"];
    const _t_1 = _t_0["t"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    if (_ys_0.$ === "Con") {
      const _t_2 = _ys_0["head"];
      const _v_0 = _t_2["up"];
      const _q_0 = _ys_0["tail"];
      const _x_0 = $$Nat_is_le(_t_1, _c_0);
      const _x_1 = $$Bool_not((_u_0 !== _v_0));
      return $Bool_and((_x_0 || _x_1), $$SPEC_frame_gt(_r_0, _q_0, _c_0));
    } else {
      return false;
    }
  } else {
    if (_ys_0.$ === "Nil") {
      return true;
    } else {
      return false;
    }
  }
}

function $SPEC_frame_lt(_xs_0, _ys_0, _c_0) {
  if (_xs_0.$ === "Con") {
    const _t_0 = _xs_0["head"];
    const _t_1 = _t_0["t"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    if (_ys_0.$ === "Con") {
      const _t_2 = _ys_0["head"];
      const _v_0 = _t_2["up"];
      const _q_0 = _ys_0["tail"];
      const _x_0 = $$Nat_is_ge(_t_1, _c_0);
      const _x_1 = $$Bool_not((_u_0 !== _v_0));
      return $Bool_and((_x_0 || _x_1), $$SPEC_frame_lt(_r_0, _q_0, _c_0));
    } else {
      return false;
    }
  } else {
    if (_ys_0.$ === "Nil") {
      return true;
    } else {
      return false;
    }
  }
}

function $SPEC_frame_id(_xs_0, _ys_0, _id_0) {
  if (_xs_0.$ === "Con") {
    const _t_0 = _xs_0["head"];
    const _i_0 = _t_0["id"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    if (_ys_0.$ === "Con") {
      const _t_2 = _ys_0["head"];
      const _v_0 = _t_2["up"];
      const _q_0 = _ys_0["tail"];
      const _x_0 = $$Nat_is_eq(_i_0, _id_0);
      const _x_1 = $$Bool_not((_u_0 !== _v_0));
      return $Bool_and((_x_0 || _x_1), $$SPEC_frame_id(_r_0, _q_0, _id_0));
    } else {
      return false;
    }
  } else {
    if (_ys_0.$ === "Nil") {
      return true;
    } else {
      return false;
    }
  }
}

function $SPEC_next_after(_xs_0, _s_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = _xs_0["head"];
    const _t_1 = _t_0["t"];
    return $Nat_is_gt(_t_1, _s_0);
  }
}

function $SPEC_placed(_xs_0, _id_0, _s_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const _t_0 = _xs_0["head"];
    const _i_0 = _t_0["id"];
    const _t_1 = _t_0["t"];
    const _r_0 = _xs_0["tail"];
    const _x_0 = $$Bool_and($$Nat_is_eq(_i_0, _id_0), $$SPEC_next_after(_r_0, _s_0));
    const _x_1 = $$Bool_and($$Bool_not($$Nat_is_eq(_i_0, _id_0)), $$Bool_and($$Nat_is_le(_t_1, _s_0), $$SPEC_placed(_r_0, _id_0, _s_0)));
    return (_x_0 || _x_1);
  }
}

function $up_to_state(_xs_0, _c_0) {
  if (_xs_0.$ === "Nil") {
    return {$: "Nil"};
  } else {
    const _t_0 = _xs_0["head"];
    const _id_0 = _t_0["id"];
    const _t_1 = _t_0["t"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    const _x_0 = $$Nat_is_le(_t_1, _c_0);
    return {$: "Con", "head": {$: "M", "id": _id_0, "t": _t_1, "up": (_u_0 || _x_0)}, "tail": $$up_to_state(_r_0, _c_0)};
  }
}

function $up_to_ran(_xs_0, _c_0) {
  if (_xs_0.$ === "Nil") {
    return {$: "Nil"};
  } else {
    const _t_0 = _xs_0["head"];
    const _id_0 = _t_0["id"];
    const _t_1 = _t_0["t"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    return $SPEC_keep($$Bool_and($$Bool_not(_u_0), $$Nat_is_le(_t_1, _c_0)), _id_0, $$up_to_ran(_r_0, _c_0));
  }
}

function $down_to_state(_xs_0, _c_0) {
  if (_xs_0.$ === "Nil") {
    return {$: "Nil"};
  } else {
    const _t_0 = _xs_0["head"];
    const _id_0 = _t_0["id"];
    const _t_1 = _t_0["t"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    return {$: "Con", "head": {$: "M", "id": _id_0, "t": _t_1, "up": $$Bool_and(_u_0, $$Bool_not($$Nat_is_ge(_t_1, _c_0)))}, "tail": $$down_to_state(_r_0, _c_0)};
  }
}

function $down_to_ran($0, $1, $2) {
  for (;;) {
    {
      const _xs_0 = $0;
      const _c_0 = $1;
      const _acc_0 = $2;
      if (_xs_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _t_0 = _xs_0["head"];
        const _id_0 = _t_0["id"];
        const _t_1 = _t_0["t"];
        const _u_0 = _t_0["up"];
        const _r_0 = _xs_0["tail"];
        $0 = _r_0;
        $1 = _c_0;
        $2 = $$SPEC_keep($$Bool_and(_u_0, $$Nat_is_ge(_t_1, _c_0)), _id_0, _acc_0);
        continue;
      }
    }
  }
}

function $up_all_state(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return {$: "Nil"};
  } else {
    const _t_0 = _xs_0["head"];
    const _id_0 = _t_0["id"];
    const _t_1 = _t_0["t"];
    const _r_0 = _xs_0["tail"];
    return {$: "Con", "head": {$: "M", "id": _id_0, "t": _t_1, "up": true}, "tail": $$up_all_state(_r_0)};
  }
}

function $up_all_ran(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return {$: "Nil"};
  } else {
    const _t_0 = _xs_0["head"];
    const _id_0 = _t_0["id"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    return $SPEC_keep($$Bool_not(_u_0), _id_0, $$up_all_ran(_r_0));
  }
}

function $down_all_state(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return {$: "Nil"};
  } else {
    const _t_0 = _xs_0["head"];
    const _id_0 = _t_0["id"];
    const _t_1 = _t_0["t"];
    const _r_0 = _xs_0["tail"];
    return {$: "Con", "head": {$: "M", "id": _id_0, "t": _t_1, "up": false}, "tail": $$down_all_state(_r_0)};
  }
}

function $down_all_ran($0, $1) {
  for (;;) {
    {
      const _xs_0 = $0;
      const _acc_0 = $1;
      if (_xs_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _t_0 = _xs_0["head"];
        const _id_0 = _t_0["id"];
        const _u_0 = _t_0["up"];
        const _r_0 = _xs_0["tail"];
        $0 = _r_0;
        $1 = $$SPEC_keep(_u_0, _id_0, _acc_0);
        continue;
      }
    }
  }
}

function $contains(_xs_0, _id_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const _t_0 = _xs_0["head"];
    const _i_0 = _t_0["id"];
    const _r_0 = _xs_0["tail"];
    const _x_0 = $$Nat_is_eq(_i_0, _id_0);
    const _x_1 = $$contains(_r_0, _id_0);
    return (_x_0 || _x_1);
  }
}

function $state_of(_xs_0, _id_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const _t_0 = _xs_0["head"];
    const _i_0 = _t_0["id"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    const _x_0 = $$Bool_and($$Nat_is_eq(_i_0, _id_0), _u_0);
    const _x_1 = $$state_of(_r_0, _id_0);
    return (_x_0 || _x_1);
  }
}

function $set_state(_xs_0, _id_0, _v_0) {
  if (_xs_0.$ === "Nil") {
    return {$: "Nil"};
  } else {
    const _t_0 = _xs_0["head"];
    const _i_0 = _t_0["id"];
    const _t_1 = _t_0["t"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    const _x_0 = $$Bool_and($$Nat_is_eq(_i_0, _id_0), _v_0);
    const _x_1 = $$Bool_and($$Bool_not($$Nat_is_eq(_i_0, _id_0)), _u_0);
    return {$: "Con", "head": {$: "M", "id": _i_0, "t": _t_1, "up": (_x_0 || _x_1)}, "tail": $$set_state(_r_0, _id_0, _v_0)};
  }
}

function $single_ran(_xs_0, _id_0, _v_0) {
  const _x_0 = $$state_of(_xs_0, _id_0);
  return $SPEC_keep($$Bool_and($$contains(_xs_0, _id_0), (_x_0 !== _v_0)), _id_0, {$: "Nil"});
}

function $first_down($0) {
  for (;;) {
    {
      const _xs_0 = $0;
      if (_xs_0.$ === "Nil") {
        return {$: "None"};
      } else {
        const _t_0 = _xs_0["head"];
        const _id_0 = _t_0["id"];
        const _t_2 = _t_0["up"];
        if (_t_2) {
          const _r_0 = _xs_0["tail"];
          $0 = _r_0;
          continue;
        } else {
          return {$: "Some", "value": _id_0};
        }
      }
    }
  }
}

function $last_up($0, $1) {
  for (;;) {
    {
      const _xs_0 = $0;
      const _last_0 = $1;
      if (_xs_0.$ === "Nil") {
        return _last_0;
      } else {
        const _t_0 = _xs_0["head"];
        const _id_0 = _t_0["id"];
        const _u_0 = _t_0["up"];
        const _r_0 = _xs_0["tail"];
        $0 = _r_0;
        $1 = $$Bool_pick(_u_0, {$: "Some", "value": _id_0}, _last_0);
        continue;
      }
    }
  }
}

function $single_found_state(_xs_0, _found_0, _v_0) {
  if (_found_0.$ === "None") {
    return _xs_0;
  } else {
    const _id_0 = _found_0["value"];
    return $set_state(_xs_0, _id_0, _v_0);
  }
}

function $single_found_ran(_xs_0, _found_0, _v_0) {
  if (_found_0.$ === "None") {
    return {$: "Nil"};
  } else {
    const _id_0 = _found_0["value"];
    return $single_ran(_xs_0, _id_0, _v_0);
  }
}

function $after(_x_0, _m_0) {
  const _t_0 = _x_0["t"];
  const _s_0 = _m_0["t"];
  return $Nat_is_gt(_t_0, _s_0);
}

function $insert(_xs_0, _m_0) {
  if (_xs_0.$ === "Nil") {
    return {$: "Con", "head": _m_0, "tail": {$: "Nil"}};
  } else {
    const _x_0 = _xs_0["head"];
    const _r_0 = _xs_0["tail"];
    return $Bool_pick($$after(_x_0, _m_0), {$: "Con", "head": _m_0, "tail": {$: "Con", "head": _x_0, "tail": _r_0}}, {$: "Con", "head": _x_0, "tail": $$insert(_r_0, _m_0)});
  }
}

function $remove(_xs_0, _id_0) {
  if (_xs_0.$ === "Nil") {
    return {$: "Nil"};
  } else {
    const _t_0 = _xs_0["head"];
    const _i_0 = _t_0["id"];
    const _t_1 = _t_0["t"];
    const _u_0 = _t_0["up"];
    const _r_0 = _xs_0["tail"];
    const _rest_0 = $$remove(_r_0, _id_0);
    return $Bool_pick($$Nat_is_eq(_i_0, _id_0), _rest_0, {$: "Con", "head": {$: "M", "id": _i_0, "t": _t_1, "up": _u_0}, "tail": _rest_0});
  }
}

function $step_state(_xs_0, _cmd_0) {
  if (_cmd_0.$ === "Add") {
    const _id_0 = _cmd_0["id"];
    const _t_0 = _cmd_0["t"];
    return $insert(_xs_0, {$: "M", "id": _id_0, "t": _t_0, "up": false});
  } else if (_cmd_0.$ === "Remove") {
    const _id_1 = _cmd_0["id"];
    return $remove(_xs_0, _id_1);
  } else if (_cmd_0.$ === "UpTo") {
    const _c_0 = _cmd_0["c"];
    return $up_to_state(_xs_0, _c_0);
  } else if (_cmd_0.$ === "DownTo") {
    const _c_1 = _cmd_0["c"];
    return $down_to_state(_xs_0, _c_1);
  } else if (_cmd_0.$ === "UpAll") {
    return $up_all_state(_xs_0);
  } else if (_cmd_0.$ === "DownAll") {
    return $down_all_state(_xs_0);
  } else if (_cmd_0.$ === "Single") {
    const _id_2 = _cmd_0["id"];
    const _up_0 = _cmd_0["up"];
    return $set_state(_xs_0, _id_2, _up_0);
  } else if (_cmd_0.$ === "NextUp") {
    return $single_found_state(_xs_0, $$first_down(_xs_0), true);
  } else {
    return $single_found_state(_xs_0, $$last_up(_xs_0, {$: "None"}), false);
  }
}

function $step_ran(_xs_0, _cmd_0) {
  if (_cmd_0.$ === "Add") {
    return {$: "Nil"};
  } else if (_cmd_0.$ === "Remove") {
    return {$: "Nil"};
  } else if (_cmd_0.$ === "UpTo") {
    const _c_0 = _cmd_0["c"];
    return $up_to_ran(_xs_0, _c_0);
  } else if (_cmd_0.$ === "DownTo") {
    const _c_1 = _cmd_0["c"];
    return $down_to_ran(_xs_0, _c_1, {$: "Nil"});
  } else if (_cmd_0.$ === "UpAll") {
    return $up_all_ran(_xs_0);
  } else if (_cmd_0.$ === "DownAll") {
    return $down_all_ran(_xs_0, {$: "Nil"});
  } else if (_cmd_0.$ === "Single") {
    const _id_2 = _cmd_0["id"];
    const _up_0 = _cmd_0["up"];
    return $single_ran(_xs_0, _id_2, _up_0);
  } else if (_cmd_0.$ === "NextUp") {
    return $single_found_ran(_xs_0, $$first_down(_xs_0), true);
  } else {
    return $single_found_ran(_xs_0, $$last_up(_xs_0, {$: "None"}), false);
  }
}

function $step(_xs_0, _cmd_0) {
  return {$: "Tuple", "fst": $$step_state(_xs_0, _cmd_0), "snd": $$step_ran(_xs_0, _cmd_0)};
}

function $replay($0, $1) {
  for (;;) {
    {
      const _cmds_0 = $0;
      const _xs_0 = $1;
      if (_cmds_0.$ === "Nil") {
        return _xs_0;
      } else {
        const _cmd_0 = _cmds_0["head"];
        const _rest_0 = _cmds_0["tail"];
        $0 = _rest_0;
        $1 = $$step_state(_xs_0, _cmd_0);
        continue;
      }
    }
  }
}

function $Nat_is_eq(_a_0, _b_0) {
  return $Cmp_is_eq(cmp_new(_a_0, _b_0));
}

function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}

function $Nat_is_le(_a_0, _b_0) {
  return $Cmp_is_le(cmp_new(_a_0, _b_0));
}

function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}

function $Nat_is_ge(_a_0, _b_0) {
  return $Cmp_is_ge(cmp_new(_a_0, _b_0));
}

function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
}

function $Bool_pick(_c_0, _a_0, _b_0) {
  if (!_c_0) {
    return _b_0;
  } else {
    return _a_0;
  }
}

function $Cmp_is_eq(_c_0) {
  if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}

function $Cmp_is_le(_c_0) {
  if (_c_0.$ === "GT") {
    return false;
  } else {
    return true;
  }
}

function $Cmp_is_ge(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else {
    return true;
  }
}

function $Cmp_is_gt(_c_0) {
  if (_c_0.$ === "GT") {
    return true;
  } else {
    return false;
  }
}

const $$SPEC_ids = $SPEC_ids;
const $$Nat_is_eq = $Nat_is_eq;
const $$SPEC_has_id = $SPEC_has_id;
const $$Nat_is_le = $Nat_is_le;
const $$SPEC_ordered_from = $SPEC_ordered_from;
const $$Bool_not = $Bool_not;
const $$SPEC_all_le_up = $SPEC_all_le_up;
const $$Nat_is_ge = $Nat_is_ge;
const $$SPEC_all_ge_down = $SPEC_all_ge_down;
const $$SPEC_all_up = $SPEC_all_up;
const $$SPEC_all_down = $SPEC_all_down;
const $$SPEC_all_with_id = $SPEC_all_with_id;
const $$SPEC_changed = $SPEC_changed;
const $$SPEC_keep = $SPEC_keep;
const $$SPEC_frame_gt = $SPEC_frame_gt;
const $$SPEC_frame_lt = $SPEC_frame_lt;
const $$SPEC_frame_id = $SPEC_frame_id;
const $$SPEC_next_after = $SPEC_next_after;
const $$Bool_and = $Bool_and;
const $$SPEC_placed = $SPEC_placed;
const $$up_to_state = $up_to_state;
const $$up_to_ran = $up_to_ran;
const $$down_to_state = $down_to_state;
const $$up_all_state = $up_all_state;
const $$up_all_ran = $up_all_ran;
const $$down_all_state = $down_all_state;
const $$contains = $contains;
const $$state_of = $state_of;
const $$set_state = $set_state;
const $$Bool_pick = $Bool_pick;
const $$after = $after;
const $$insert = $insert;
const $$remove = $remove;
const $$first_down = $first_down;
const $$last_up = $last_up;
const $$step_state = $step_state;
const $$step_ran = $step_ran;export default {
  "SPEC:keep": run_lib((a0,a1,a2) => run_loop($SPEC_keep(a0,nat_in(a1),a2)), 3),
  "SPEC:ids": run_lib((a0) => run_loop($SPEC_ids(a0)), 1),
  "SPEC:has_id": run_lib((a0,a1) => run_loop($SPEC_has_id(a0,nat_in(a1))), 2),
  "SPEC:ordered_from": run_lib((a0,a1) => run_loop($SPEC_ordered_from(a0,nat_in(a1))), 2),
  "SPEC:ordered": run_lib((a0) => run_loop($SPEC_ordered(a0)), 1),
  "SPEC:all_le_up": run_lib((a0,a1) => run_loop($SPEC_all_le_up(a0,nat_in(a1))), 2),
  "SPEC:all_ge_down": run_lib((a0,a1) => run_loop($SPEC_all_ge_down(a0,nat_in(a1))), 2),
  "SPEC:all_up": run_lib((a0) => run_loop($SPEC_all_up(a0)), 1),
  "SPEC:all_down": run_lib((a0) => run_loop($SPEC_all_down(a0)), 1),
  "SPEC:all_with_id": run_lib((a0,a1,a2) => run_loop($SPEC_all_with_id(a0,nat_in(a1),a2)), 3),
  "SPEC:changed": run_lib((a0,a1) => run_loop($SPEC_changed(a0,a1)), 2),
  "SPEC:changed_latest_first": run_lib((a0,a1,a2) => run_loop($SPEC_changed_latest_first(a0,a1,a2)), 3),
  "SPEC:frame_gt": run_lib((a0,a1,a2) => run_loop($SPEC_frame_gt(a0,a1,nat_in(a2))), 3),
  "SPEC:frame_lt": run_lib((a0,a1,a2) => run_loop($SPEC_frame_lt(a0,a1,nat_in(a2))), 3),
  "SPEC:frame_id": run_lib((a0,a1,a2) => run_loop($SPEC_frame_id(a0,a1,nat_in(a2))), 3),
  "SPEC:next_after": run_lib((a0,a1) => run_loop($SPEC_next_after(a0,nat_in(a1))), 2),
  "SPEC:placed": run_lib((a0,a1,a2) => run_loop($SPEC_placed(a0,nat_in(a1),nat_in(a2))), 3),
  "up_to_state": run_lib((a0,a1) => run_loop($up_to_state(a0,nat_in(a1))), 2),
  "up_to_ran": run_lib((a0,a1) => run_loop($up_to_ran(a0,nat_in(a1))), 2),
  "down_to_state": run_lib((a0,a1) => run_loop($down_to_state(a0,nat_in(a1))), 2),
  "down_to_ran": run_lib((a0,a1,a2) => run_loop($down_to_ran(a0,nat_in(a1),a2)), 3),
  "up_all_state": run_lib((a0) => run_loop($up_all_state(a0)), 1),
  "up_all_ran": run_lib((a0) => run_loop($up_all_ran(a0)), 1),
  "down_all_state": run_lib((a0) => run_loop($down_all_state(a0)), 1),
  "down_all_ran": run_lib((a0,a1) => run_loop($down_all_ran(a0,a1)), 2),
  "contains": run_lib((a0,a1) => run_loop($contains(a0,nat_in(a1))), 2),
  "state_of": run_lib((a0,a1) => run_loop($state_of(a0,nat_in(a1))), 2),
  "set_state": run_lib((a0,a1,a2) => run_loop($set_state(a0,nat_in(a1),a2)), 3),
  "single_ran": run_lib((a0,a1,a2) => run_loop($single_ran(a0,nat_in(a1),a2)), 3),
  "first_down": run_lib((a0) => run_loop($first_down(a0)), 1),
  "last_up": run_lib((a0,a1) => run_loop($last_up(a0,a1)), 2),
  "single_found_state": run_lib((a0,a1,a2) => run_loop($single_found_state(a0,a1,a2)), 3),
  "single_found_ran": run_lib((a0,a1,a2) => run_loop($single_found_ran(a0,a1,a2)), 3),
  "after": run_lib((a0,a1) => run_loop($after(a0,a1)), 2),
  "insert": run_lib((a0,a1) => run_loop($insert(a0,a1)), 2),
  "remove": run_lib((a0,a1) => run_loop($remove(a0,nat_in(a1))), 2),
  "step_state": run_lib((a0,a1) => run_loop($step_state(a0,a1)), 2),
  "step_ran": run_lib((a0,a1) => run_loop($step_ran(a0,a1)), 2),
  "step": run_lib((a0,a1) => run_loop($step(a0,a1)), 2),
  "replay": run_lib((a0,a1) => run_loop($replay(a0,a1)), 2),
};
