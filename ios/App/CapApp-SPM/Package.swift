// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v13)],
    products: [
        .library(name: "CapApp-SPM", targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "6.2.2"),
        .package(path: "../LocalPlugins/CapacitorApp"),
        .package(path: "../LocalPlugins/CapacitorFilesystem"),
        .package(path: "../LocalPlugins/CapacitorShare"),
        .package(path: "../LocalPlugins/CapacitorCommunityContacts"),
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorFilesystem", package: "CapacitorFilesystem"),
                .product(name: "CapacitorShare", package: "CapacitorShare"),
                .product(name: "CapacitorCommunityContacts", package: "CapacitorCommunityContacts"),
            ]
        )
    ]
)
