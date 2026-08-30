# 금융시장론 스터디 사이트

인하대 2학년 2학기 금융시장론 과제. Vite + React 19 + vinext 기반 스터디 노트 사이트.

---

## ⚠️ 규칙 0 — 이 폴더를 iCloud 안에 두지 말 것

**올바른 위치**

```
~/Projects/financial-markets-study
```

**두면 안 되는 위치**

- `~/Documents/...` (「데스크탑 및 문서 폴더」 동기화가 켜져 있으면 이건 iCloud입니다)
- `~/Desktop/...`
- `~/Library/Mobile Documents/...` (iCloud Drive)
- OneDrive, Google Drive 폴더

**이유** — `node_modules`에 파일이 4만 개 넘게 들어갑니다. iCloud가 이걸 전부 동기화하려 들면서
`fileproviderd` / `cloudd` / `bird` 가 CPU를 물고 늘어집니다.
2026-08-30에 실제로 이 문제로 맥북 load average가 72까지 올라갔습니다.
(`Documents` 전체 파일 56,058개 중 41,592개가 이 프로젝트의 `node_modules`였음)

**맥북 ↔ 맥미니 동기화는 iCloud가 아니라 GitHub로 합니다.** 아래 참고.

---

## 1. 새 컴퓨터에서 처음 세팅 (1회만)

필요 조건: **Node.js 22.13.0 이상** (`package.json`의 `engines`)

```bash
node -v
```

```bash
mkdir -p ~/Projects && cd ~/Projects && git clone https://github.com/hyunchanwi/financial-markets-study.git
```

```bash
cd ~/Projects/financial-markets-study && npm install
```

공개 저장소라서 `clone`에는 로그인이 필요 없습니다.

---

## 2. 매일 작업 흐름 — 앉으면 pull, 일어나면 push

**작업 시작할 때** (다른 기기에서 한 작업 받아오기)

```bash
cd ~/Projects/financial-markets-study && git pull
```

**작업 끝내고 자리 뜰 때** (지금 기기 작업 올려보내기)

```bash
git add -A && git commit -m "무엇을 했는지 한 줄" && git push
```

> `push`를 깜빡하면 그 작업은 그 컴퓨터에만 남습니다.
> iCloud처럼 자동이 아닙니다. **자리 뜨기 전 `git push`가 습관이 되어야 합니다.**

지금 상태가 궁금하면:

```bash
git status
```

---

## 3. 개발 서버 / 명령어

| 명령어 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 실행 (작업할 때 쓰는 것) |
| `npm run build` | 전체 빌드 |
| `npm run build:pages` | GitHub Pages용 정적 빌드 → `dist-pages/` |
| `npm start` | 빌드 결과를 wrangler로 로컬 실행 |
| `npm run lint` | oxlint 검사 |
| `npm run format` | oxfmt 포맷팅 |

작업이 끝나면 **개발 서버를 꼭 종료**하세요 (터미널에서 `Ctrl+C`).
켜둔 채 방치하면 파일 감시 프로세스가 계속 CPU를 씁니다.

---

## 4. node_modules는 동기화하는 물건이 아닙니다

- 소스 코드가 아니라 **npm이 인터넷에서 받아온 라이브러리 캐시**입니다 (약 631MB / 41,592개 파일)
- `.gitignore`에 들어 있어 GitHub에 올라가지 않습니다 — 정상입니다
- `package-lock.json`에 버전이 고정돼 있어서, 어느 컴퓨터에서든 `npm install` 한 번이면 똑같이 재생성됩니다
- 안에 Mac 칩용으로 컴파일된 바이너리가 섞여 있어서, 동기화로 옮기면 오히려 깨집니다
- **컴퓨터마다 따로 만들어지는 게 정상이고, 그게 목적입니다**

내가 직접 쓴 코드는 `app/` `components/` `hooks/` `lib/` `src/` 안에 있고, 전부 합쳐도 1MB 미만입니다.

---

## 5. main에 push하면 사이트가 자동 배포됩니다

`.github/workflows/deploy-pages.yml` 이 `main` 브랜치 push를 감지해
`npm run build:pages` → GitHub Pages 배포를 자동 실행합니다.

**즉 `git push`는 곧 사이트 공개 반영입니다.** 아직 보여주기 싫은 작업이라면
별도 브랜치에서 작업하거나, 커밋만 하고 push는 미루세요.

배포 상황은 GitHub 저장소의 **Actions** 탭에서 볼 수 있습니다.

---

## 6. 자주 겪는 문제

**`git push`가 로그인을 요구할 때**
GitHub 계정 비밀번호가 아니라 **Personal Access Token**을 넣어야 합니다.
GitHub → Settings → Developer settings → Personal access tokens에서 발급.
한 번 입력하면 macOS 키체인에 저장되어 다시 묻지 않습니다.

**`git pull`에서 충돌이 났을 때**
양쪽 기기에서 각각 작업하고 push하지 않아 생깁니다.
git이 멈추고 알려주므로 iCloud처럼 조용히 덮어쓰이지는 않습니다.
급하면 현재 작업을 잠시 치워두고 받아올 수 있습니다:

```bash
git stash && git pull && git stash pop
```

**`npm install`이 실패할 때**
먼저 Node 버전을 확인하세요 (22.13.0 이상 필요). 그래도 안 되면 지우고 다시:

```bash
rm -rf node_modules package-lock.json && npm install
```

단, `package-lock.json`을 지우면 버전이 달라질 수 있으니 최후의 수단입니다.

**맥이 갑자기 느려지고 팬이 돌 때**
이 프로젝트가 iCloud 폴더 안에 들어가 있지 않은지부터 확인하세요.

```bash
pwd
```

경로에 `Documents`, `Desktop`, `Mobile Documents`가 보이면 규칙 0 위반입니다.
현재 부하를 확인하려면:

```bash
ps -Aceo pcpu,comm -r | head -10
```

`fileproviderd` / `cloudd` / `bird` 가 상위에 올라와 있으면 클라우드 동기화가 원인입니다.

---

## 7. 기기 메모

| | 맥북 | 맥미니 |
|---|---|---|
| 프로젝트 경로 | `~/Projects/financial-markets-study` | `~/Projects/financial-markets-study` |
| 동기화 방법 | GitHub (`pull` / `push`) | GitHub (`pull` / `push`) |
| node_modules | 각자 `npm install` | 각자 `npm install` |

인하대 과제의 **한글 파일·PDF·보고서는 계속 iCloud 자동 동기화**를 씁니다.
Git으로 관리하는 것은 이 코드 폴더 하나뿐입니다.
