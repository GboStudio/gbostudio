#!/usr/bin/env python3
"""Block public museum smoke checks until GitHub Pages deploys this exact SHA.

GitHub's generated "pages build and deployment" workflow uses event=dynamic.
GitHub workflow_run triggers do not reliably fire from this system workflow.
Run this gate on push/main instead, then check the actual published website.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

def get_pages_run(runs, sha):
    matches = [
        x for x in runs
        if x.get("name") == "pages build and deployment"
        and x.get("head_sha") == sha
    ]
    if not matches:
        return None
    matches.sort(key=lambda x: (x.get("created_at") or "", x.get("id", 0)), reverse=True)
    return matches[0]

def wait_for_pages(repo, sha, timeout=360, pause=12):
    if not repo or "/" not in repo or len(sha) < 12:
        raise ValueError("A repository and a full Git commit SHA are required")
    url = "https://api.github.com/repos/" + repo + "/actions/runs?" + urllib.parse.urlencode({
        "head_sha": sha,
        "per_page": "100",
    })
    token = os.getenv("GITHUB_TOKEN", "")
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "the-unreal-museum-ci-postdeployment-gate",
    }
    if token:
        headers["Authorization"] = "Bearer " + token
    deadline = time.monotonic() + timeout
    attempt = 0
    while time.monotonic() < deadline:
        attempt += 1
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=20) as response:
                data = json.load(response)
            run = get_pages_run(data.get("workflow_runs", []), sha)
            if run:
                status = run.get("status")
                result = run.get("conclusion")
                print(f"GitHub Pages attempt {attempt}: {status}, result={result}, "
                      f"run={run.get('html_url')}", flush=True)
                if status == "completed":
                    if result == "success":
                        print("PAGES_DEPLOYMENT_CONFIRMED", sha, flush=True)
                        return True
                    raise RuntimeError("GitHub Pages deployment failed: " + str(result))
            else:
                print(f"GitHub Pages attempt {attempt}: waiting for build of {sha[:12]}", flush=True)
        except (urllib.error.URLError, TimeoutError) as error:
            print("GitHub API temporarily unavailable:", error, flush=True)
        time.sleep(min(pause, max(0, deadline - time.monotonic())))
    raise TimeoutError("No successful Pages deployment for the tested commit within "
                       + str(timeout) + " seconds")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--sha", required=True)
    parser.add_argument("--timeout", type=int, default=300)
    args = parser.parse_args()
    try:
        wait_for_pages(args.repo, args.sha, timeout=args.timeout)
    except (ValueError, RuntimeError, TimeoutError) as exc:
        print("::error::" + str(exc), file=sys.stderr)
        sys.exit(1)
