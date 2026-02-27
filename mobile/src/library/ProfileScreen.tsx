import { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { AppButton, AppInput, AppText, BookCover, RatingStars, Surface } from "../primitives";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/tokens";
import type { LibraryBook, LibraryFriend, UserProfile } from "../types/library";
import { resolveBookCoverUri } from "./figmaAssets";

type ProfileScreenProps = {
  profile: UserProfile | null;
  books: LibraryBook[];
  friends: LibraryFriend[];
  onSaveProfile: (
    patch: Partial<Pick<UserProfile, "displayName" | "bio" | "location" | "website" | "badge" | "avatarUrl">>
  ) => Promise<void>;
};

const fallbackName = "Shelf Reader";
const fallbackBadge = "PATRON";

export function ProfileScreen({
  profile,
  books,
  friends,
  onSaveProfile,
}: ProfileScreenProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [location, setLocation] = useState(profile?.location || "");
  const [website, setWebsite] = useState(profile?.website || "");
  const [badge, setBadge] = useState(profile?.badge || fallbackBadge);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName || "");
    setBio(profile?.bio || "");
    setLocation(profile?.location || "");
    setWebsite(profile?.website || "");
    setBadge(profile?.badge || fallbackBadge);
    setAvatarUrl(profile?.avatarUrl || "");
  }, [profile]);

  const favoriteBooks = useMemo(() => {
    if (profile?.favoriteBooks && profile.favoriteBooks.length > 0) {
      return profile.favoriteBooks.slice(0, 8);
    }
    return books.filter((book) => book.liked).slice(0, 8);
  }, [books, profile?.favoriteBooks]);

  const recentReviews = useMemo(() => {
    if (profile?.recentReviews && profile.recentReviews.length > 0) {
      return profile.recentReviews.slice(0, 4);
    }
    return books.filter((book) => Boolean(book.review)).slice(0, 4);
  }, [books, profile?.recentReviews]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await onSaveProfile({
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
        badge: badge.trim() || fallbackBadge,
        avatarUrl: avatarUrl.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const profileName = displayName.trim() || profile?.displayName || fallbackName;
  const profileBadge = badge.trim() || profile?.badge || fallbackBadge;
  const profileMetrics = profile?.metrics;
  const stats = [
    { label: "BOOKS", value: profileMetrics?.booksInLibrary ?? books.length },
    { label: "THIS YEAR", value: profileMetrics?.booksThisYear ?? books.length },
    { label: "SHELVES", value: profileMetrics?.shelves ?? 1 },
    { label: "FRIENDS", value: profileMetrics?.friends ?? friends.length },
    { label: "LOANS", value: profileMetrics?.activeLoans ?? books.filter((book) => book.loaned).length },
  ];

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          {avatarUrl || profile?.avatarUrl ? (
            <Image source={{ uri: avatarUrl || profile?.avatarUrl || "" }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <AppText variant="h3">{profileName.slice(0, 2).toUpperCase()}</AppText>
            </View>
          )}
        </View>

        <View style={styles.headerBody}>
          <View style={styles.nameRow}>
            <AppText variant="h2">{profileName}</AppText>
            <View style={styles.badge}>
              <AppText variant="caption" tone="inverse">
                {profileBadge}
              </AppText>
            </View>
          </View>

          <AppText variant="bodySm" tone="muted">
            {bio || "Keep your shelf synced across scans and search."}
          </AppText>

          <View style={styles.metaRow}>
            {location ? (
              <AppText variant="caption" tone="muted">
                {location}
              </AppText>
            ) : null}
            {website ? (
              <AppText variant="caption" tone="accent">
                {website}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.followedByRow}>
        <View style={styles.friendStack}>
          {friends.slice(0, 3).map((friend, index) => (
            <View
              key={friend.id}
              style={[styles.friendBubble, { marginLeft: index === 0 ? 0 : -8 }]}
            >
              <AppText variant="caption">{friend.initials}</AppText>
            </View>
          ))}
        </View>
        <AppText variant="caption" tone="muted">
          Followed by {friends.slice(0, 3).map((friend) => friend.name).join(", ") || "friends"}
        </AppText>
      </View>

      <Surface variant="card" style={styles.statsCard}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statCol}>
            <AppText variant="h3">{stat.value}</AppText>
            <AppText variant="caption" tone="muted">
              {stat.label}
            </AppText>
          </View>
        ))}
      </Surface>

      <View style={styles.section}>
        <AppText variant="h3">Favourite Books</AppText>
        <View style={styles.favoritesGrid}>
          {favoriteBooks.map((book) => (
            <View key={book.id} style={styles.favoriteItem}>
              <BookCover
                uri={resolveBookCoverUri(book.title, book.coverThumbnail)}
                width={70}
                height={105}
                borderRadius={radius.xs}
              />
              <AppText variant="caption" numberOfLines={1} style={styles.favoriteTitle}>
                {book.title}
              </AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {book.author}
              </AppText>
              <RatingStars rating={book.rating} size="sm" />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="h3">Recent Reviews</AppText>
        <View style={styles.reviewsList}>
          {recentReviews.map((book) => (
            <Surface key={book.id} variant="card" style={styles.reviewCard}>
              <BookCover
                uri={resolveBookCoverUri(book.title, book.coverThumbnail)}
                width={36}
                height={54}
                borderRadius={radius.xs}
              />
              <View style={styles.reviewBody}>
                <AppText variant="h3" numberOfLines={1}>
                  {book.title}
                </AppText>
                <RatingStars rating={book.rating} size="sm" />
                <AppText variant="caption" tone="muted" numberOfLines={2}>
                  {book.review || "Reviewed"}
                </AppText>
              </View>
            </Surface>
          ))}
          {recentReviews.length === 0 ? (
            <Surface variant="panel" style={styles.emptyCard}>
              <AppText variant="bodySm" tone="muted">
                No reviews yet.
              </AppText>
            </Surface>
          ) : null}
        </View>
      </View>

      <Surface variant="card" style={styles.formCard}>
        <AppText variant="h3">Profile Details</AppText>
        <AppInput value={displayName} onChangeText={setDisplayName} label="Display name" placeholder="Name" />
        <AppInput value={badge} onChangeText={setBadge} label="Badge" placeholder="PATRON" />
        <AppInput value={bio} onChangeText={setBio} label="Bio" placeholder="Bio" variant="textarea" />
        <AppInput value={location} onChangeText={setLocation} label="Location" placeholder="Location" />
        <AppInput value={website} onChangeText={setWebsite} label="Website" placeholder="Website" />
        <AppInput value={avatarUrl} onChangeText={setAvatarUrl} label="Avatar URL" placeholder="https://..." />
        <AppButton
          label={saving ? "Saving..." : "Save Profile"}
          variant="primary"
          size="md"
          fullWidth
          disabled={saving}
          onPress={() => {
            void saveProfile();
          }}
        />
      </Surface>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  avatarWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "rgba(212,165,116,0.35)",
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBody: {
    flex: 1,
    gap: spacing.sm,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  badge: {
    height: 22,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  followedByRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  friendStack: {
    flexDirection: "row",
  },
  friendBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.background,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  statsCard: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderColor: "rgba(212,165,116,0.12)",
    rowGap: spacing.md,
  },
  statCol: {
    minWidth: "18%",
    alignItems: "center",
    gap: 1,
  },
  section: {
    gap: spacing.sm,
  },
  favoritesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  favoriteItem: {
    width: 72,
    gap: 2,
  },
  favoriteTitle: {
    marginTop: spacing.xs,
  },
  reviewsList: {
    gap: spacing.sm,
  },
  reviewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderColor: "rgba(212,165,116,0.12)",
  },
  reviewBody: {
    flex: 1,
    gap: 2,
  },
  emptyCard: {
    padding: spacing.md,
  },
  formCard: {
    padding: spacing.lg,
    gap: spacing.sm,
  }
});
