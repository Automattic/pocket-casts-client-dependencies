# pocket-casts-client-dependencies

Binary dependencies for the Pocket Casts clients: prebuilt libraries that iOS (SwiftPM) and Android (Gradle) apps depend on without building them. Each git tag is a consistent set.

| Library | What it is | Sources |
|---|---|---|
| **Playback** | The end-of-year Playback experience: a web bundle hosted by `PlaybackKit` (iOS) and `com.automattic.pocketcasts:playback` (Android) | [pocket-casts-playback-2026](https://github.com/Automattic/pocket-casts-playback-2026) |

| Tag | Playback |
|---|---|
| `0.1.0` | 0.1.0 |
| `0.2.0` | 0.2.0 |
| `0.3.0` | 0.3.0 |
| `0.4.0` | 0.4.0 |

## iOS (SwiftPM)

In Xcode: **File ▸ Add Package Dependencies…** and enter `https://github.com/Automattic/pocket-casts-client-dependencies`. Or in a `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/Automattic/pocket-casts-client-dependencies", from: "0.4.0"),
],
targets: [
    .target(name: "MyApp", dependencies: [
        .product(name: "PlaybackKit", package: "pocket-casts-client-dependencies"),
    ]),
]
```

`PlaybackKit.xcframework` is committed at the root (device and simulator, library evolution on), the same way as `pocket-casts-ios-fingerprint`. The web bundle is inside it.

## Android (Gradle)

The repository is also a Maven repository, under [`android/maven`](android/maven), served by GitHub's raw file host. In `settings.gradle.kts`:

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven {
            url = uri("https://raw.githubusercontent.com/Automattic/pocket-casts-client-dependencies/trunk/android/maven")
            content { includeGroup("com.automattic.pocketcasts") }   // only ask this repo for our own artifacts
        }
    }
}
```

and in the module:

```kotlin
dependencies {
    implementation("com.automattic.pocketcasts:playback:0.4.0")
}
```

Every version stays in the repository, so `trunk` in the URL is fine: the version in `implementation(…)` is what pins. The POM lists the library's own dependencies (kotlinx-serialization-json, kotlin-stdlib, core-ktx, webkit), which resolve from `google()` and `mavenCentral()`.

## Publishing a new version

From a checkout of the library's sources, build and drop the result into this repository:

```sh
scripts/build-binaries.sh <version> all --publish ~/path/to/pocket-casts-client-dependencies
```

Then here: add a row to the table above, commit, tag with the version and push, so that `from: "<version>"` resolves:

```sh
git add -A && git commit -m "Playback <version>"
git tag <version> && git push origin trunk <version>
```

Notes:

- **This repository is public**, and so is everything inside the binaries, including the Playback web bundle's copy and layouts. Don't publish anything here that is not meant to be public.
- Every iOS version adds a few MB of history. That's fine for a handful of libraries; if it grows, move the xcframeworks to release assets and switch `Package.swift` to `.binaryTarget(url:checksum:)`.
- A tag applies to the whole repository. When a second library is added, a tag carries both, and the table above says which versions.
