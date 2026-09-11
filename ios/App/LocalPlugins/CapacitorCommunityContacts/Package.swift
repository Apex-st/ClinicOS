// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorCommunityContacts",
    platforms: [.iOS(.v13)],
    products: [
        .library(name: "CapacitorCommunityContacts", targets: ["ContactsPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "6.2.2")
    ],
    targets: [
        .target(
            name: "ContactsPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin",
            exclude: ["Info.plist"],
            publicHeadersPath: "."
        )
    ]
)
