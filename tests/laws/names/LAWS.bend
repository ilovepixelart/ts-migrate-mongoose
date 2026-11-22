# Migration names: the laws. The human states them; PROOF.bend must prove them.

import Base
import ./main.bend as Name
import ./SPEC.bend as Spec

# LAW: the program accepts exactly the names the specification describes, on every string
law valid_is_spec:
  for +s: String
  {Spec.valid(s) == Name.valid(s) : Bool}

# LAW: an accepted name never contains ".."
law valid_has_no_double_dot:
  for +s: String
  {Bool.and(Name.valid(s), Spec.has_double_dot(s, False{})) == False{} : Bool}

# LAW: an accepted name never contains "/" or "\"
law valid_has_no_slash:
  for +s: String
  {Bool.and(Name.valid(s), Spec.has_slash(s)) == False{} : Bool}

# LAW: some name is accepted, so the laws above are not met by accepting nothing
law valid_witness:
  exs s: String
  {Name.valid(s) == True{} : Bool}
