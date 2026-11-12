"""Hard resource limits for fits: thread caps before heavy imports and an RSS watchdog.

The sweep checks memory only at checkpoints, so one UMAP or HDBSCAN fit can still exhaust a
small machine. The watchdog samples resident memory twice a second and ends the process with
exit code 137 once it passes the limit; resumable runs then restart from their last checkpoint.
"""
from __future__ import annotations

import os
from pathlib import Path
import sys
import threading
import time

from .io import atomic_json, now

THREAD_VARIABLES=('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','NUMBA_NUM_THREADS')


def cap_threads(threads):
    """Set before numpy/numba load; later imports read these once."""
    for key in THREAD_VARIABLES:
        os.environ.setdefault(key,str(threads))
    # Transformers otherwise imports TensorFlow next to torch; the futures pilot died with both loaded.
    os.environ.setdefault('USE_TF','0')
    os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL','3')


def watchdog(memory_gb,report=None,interval=0.5):
    """One watchdog per process; the first limit set wins."""
    running=next((t for t in threading.enumerate() if t.name=='memory-watchdog'),None)
    if running:
        return running
    import psutil
    process=psutil.Process()
    def watch():
        while True:
            rss=process.memory_info().rss/1024**3
            if rss>memory_gb:
                message=f'Process RSS {rss:.2f} GB passed the {memory_gb} GB limit during a fit'
                if report:
                    try:
                        atomic_json(Path(report),{'reason':message,'at':now(),'exit_code':137})
                    except OSError:
                        pass
                print(message,file=sys.stderr,flush=True)
                os._exit(137)
            time.sleep(interval)
    thread=threading.Thread(target=watch,name='memory-watchdog',daemon=True)
    thread.start()
    return thread


def guard(resources,report=None):
    cap_threads(resources['cpu_threads'])
    return watchdog(resources['memory_gb'],report)
