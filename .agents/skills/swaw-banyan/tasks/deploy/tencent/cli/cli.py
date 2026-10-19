import sys
from types import SimpleNamespace

import requests
from tccli import oauth
from tccli.main import main


def verified_post(*args, **kwargs):
    kwargs["verify"] = True
    return requests.post(*args, **kwargs)


# tccli 3.1.182.1 disables TLS verification for OAuth acquisition and refresh.
oauth.requests = SimpleNamespace(post=verified_post)
sys.exit(main())
