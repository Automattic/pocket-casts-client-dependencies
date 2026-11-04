// swift-tools-version: 5.9
import PackageDescription

// Prebuilt binaries of the libraries shared by the Pocket Casts clients.
// Each release tag is a consistent set; see README.md for what a tag carries.
let package = Package(
    name: "PocketCastsClientDependencies",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "PlaybackKit", targets: ["PlaybackKit"]),
    ],
    targets: [
        .binaryTarget(name: "PlaybackKit", path: "PlaybackKit.xcframework"),
    ]
)
