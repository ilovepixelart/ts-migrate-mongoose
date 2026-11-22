"""Run a command in a pseudo-terminal and type its keys once the prompt has rendered.

Each key waits until the output has been quiet for SETTLE_S, since not every key redraws the prompt.
Besides plain keys, a key can be an action:
  <resize:ROWS>   change the terminal height (the kernel sends SIGWINCH)
  <signal:NAME>   send a signal such as SIGTERM to the command

Usage: PTY_ROWS=24 python3 pty_drive.py <keys-json> <render-marker> <command> [args...]
Prints {"exitCode": int | null, "output": str, "timedOut": bool, "aliveAfterSignal": bool} as JSON.
"""

import fcntl
import json
import os
import pty
import re
import select
import signal
import struct
import sys
import termios
import time

TIMEOUT_S = 50  # below harness.ts PROCESS_TIMEOUT_MS, so a hung prompt reports a timed-out step
# The prompt writes its frame, then switches the terminal to raw mode; a key typed in between
# would go through the line discipline (\r becomes \n, Ctrl+C becomes SIGINT).
SETTLE_S = 0.3
# How long a signalled command may take to exit before it counts as having ignored the signal.
SIGNAL_GRACE_S = 5
COLUMNS = 80


def set_rows(fd: int, rows: int) -> None:
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, COLUMNS, 0, 0))


def act(pid: int, fd: int, key: str) -> bool:
    """Perform one key or action; return True when a signal was sent."""
    resize = re.fullmatch(r"<resize:(\d+)>", key)
    if resize:
        set_rows(fd, int(resize.group(1)))
        return False
    named = re.fullmatch(r"<signal:(SIG[A-Z]+)>", key)
    if named:
        os.kill(pid, getattr(signal, named.group(1)))
        return True
    os.write(fd, key.encode())
    return False


def drive(keys: list[str], marker: bytes, command: list[str]) -> dict[str, object]:
    pid, fd = pty.fork()
    if pid == 0:
        set_rows(0, int(os.environ.get("PTY_ROWS", "24")))
        os.execvp(command[0], command)
    output = b""
    last_read = time.monotonic()
    deadline = last_read + TIMEOUT_S
    signalled_at = None
    timed_out = False
    alive_after_signal = False
    while True:
        ready, _, _ = select.select([fd], [], [], 0.05)
        if ready:
            try:
                chunk = os.read(fd, 4096)
            except OSError:
                break
            if not chunk:
                break
            output += chunk
            last_read = time.monotonic()
        now = time.monotonic()
        if keys and now - last_read >= SETTLE_S and marker in output:
            if act(pid, fd, keys.pop(0)):
                signalled_at = now
            last_read = time.monotonic()
        if signalled_at is not None and now - signalled_at > SIGNAL_GRACE_S:
            alive_after_signal = True
            os.kill(pid, signal.SIGKILL)
            break
        if now > deadline:
            timed_out = True
            os.kill(pid, signal.SIGKILL)
            break
    _, status = os.waitpid(pid, 0)
    exit_code = None if timed_out or alive_after_signal else os.waitstatus_to_exitcode(status)
    text = output.decode("utf8", "replace").replace("\r\n", "\n")
    return {"exitCode": exit_code, "output": text, "timedOut": timed_out, "aliveAfterSignal": alive_after_signal}


if __name__ == "__main__":
    result = drive(json.loads(sys.argv[1]), sys.argv[2].encode(), sys.argv[3:])
    sys.stdout.write(json.dumps(result))
