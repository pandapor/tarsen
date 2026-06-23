# @tarsen/cli

```bash
npm install -g @tarsen/cli
tarsen check create-next-app
tarsen check create-next-app --json
tarsen run create-next-app my-app
```

`check` downloads and extracts the package into a temporary directory. It never executes package code or lifecycle scripts. `run` requires the user to type `run` before invoking `npx` without a shell.
