import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import AcceptBookIcon from "../icons/AcceptBookIcon";
import DeclineBookIcon from "../icons/DeclineBookIcon";
import { colors } from "../theme/colors";
import type { FeedItem } from "../types/vision";

export type ReviewStackCard = {
  spineId: string;
  item: FeedItem;
  captureNumber: number;
  candidateIndex: number;
  candidateCount: number;
  hasMoreCandidates: boolean;
};

type BookApprovalStackProps = {
  cards: ReviewStackCard[];
  onApprove: (spineId: string) => void;
  onReject: (spineId: string) => void;
};

type SwipeDecisionCardProps = {
  card: ReviewStackCard;
  depth: number;
  isTop: boolean;
  onApprove: (spineId: string) => void;
  onReject: (spineId: string) => void;
};

const MAX_VISIBLE_CARDS = 4;
const CARD_OFFSET = 9;
const SWIPE_THRESHOLD = 105;
const EXIT_DISTANCE = Dimensions.get("window").width * 1.1;

const formatSource = (source: FeedItem["source"]): string =>
  source === "lookup" ? "Google Books" : "OCR fallback";

const normalizeCoverUri = (uri?: string): string | undefined => {
  if (!uri) {
    return undefined;
  }
  return uri.replace(/^http:\/\//i, "https://");
};

function SwipeDecisionCard({ card, depth, isTop, onApprove, onReject }: SwipeDecisionCardProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const animatingRef = useRef(false);
  const flipScaleX = useRef(new Animated.Value(1)).current;
  const [displayCard, setDisplayCard] = useState(card);

  useEffect(() => {
    if (displayCard.item.id === card.item.id) {
      return;
    }

    if (!isTop) {
      setDisplayCard(card);
      return;
    }

    Animated.timing(flipScaleX, {
      toValue: 0,
      duration: 115,
      useNativeDriver: true
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }
      setDisplayCard(card);
      Animated.timing(flipScaleX, {
        toValue: 1,
        duration: 115,
        useNativeDriver: true
      }).start();
    });
  }, [card, displayCard.item.id, flipScaleX, isTop]);

  const rotation = pan.x.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: ["-14deg", "0deg", "14deg"],
    extrapolate: "clamp"
  });

  const approveOpacity = pan.x.interpolate({
    inputRange: [0, 90, 180],
    outputRange: [0, 0.7, 1],
    extrapolate: "clamp"
  });

  const rejectOpacity = pan.x.interpolate({
    inputRange: [-180, -90, 0],
    outputRange: [1, 0.7, 0],
    extrapolate: "clamp"
  });

  const settleToCenter = () => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      tension: 52,
      friction: 8,
      useNativeDriver: true
    }).start();
  };

  const approve = () => {
    if (!isTop || animatingRef.current) {
      return;
    }
    animatingRef.current = true;
    Animated.parallel([
      Animated.timing(pan.x, {
        toValue: EXIT_DISTANCE,
        duration: 220,
        useNativeDriver: true
      }),
      Animated.timing(pan.y, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true
      })
    ]).start(() => {
      pan.setValue({ x: 0, y: 0 });
      animatingRef.current = false;
      onApprove(card.spineId);
    });
  };

  const reject = () => {
    if (!isTop || animatingRef.current) {
      return;
    }
    animatingRef.current = true;

    if (card.hasMoreCandidates) {
      Animated.sequence([
        Animated.timing(pan.x, {
          toValue: -42,
          duration: 95,
          useNativeDriver: true
        }),
        Animated.spring(pan.x, {
          toValue: 0,
          tension: 55,
          friction: 8,
          useNativeDriver: true
        })
      ]).start(() => {
        pan.setValue({ x: 0, y: 0 });
        animatingRef.current = false;
        onReject(card.spineId);
      });
      return;
    }

    Animated.parallel([
      Animated.timing(pan.x, {
        toValue: -EXIT_DISTANCE,
        duration: 220,
        useNativeDriver: true
      }),
      Animated.timing(pan.y, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true
      })
    ]).start(() => {
      pan.setValue({ x: 0, y: 0 });
      animatingRef.current = false;
      onReject(card.spineId);
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          isTop &&
          !animatingRef.current &&
          Math.abs(gestureState.dx) > 6 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_event, gestureState) => {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy * 0.12 });
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dx > SWIPE_THRESHOLD) {
            approve();
            return;
          }
          if (gestureState.dx < -SWIPE_THRESHOLD) {
            reject();
            return;
          }
          settleToCenter();
        },
        onPanResponderTerminate: settleToCenter
      }),
    [approve, isTop, pan, reject]
  );

  const coverUri = normalizeCoverUri(
    displayCard.item.metadata?.imageLinks?.thumbnail ?? displayCard.item.metadata?.imageLinks?.smallThumbnail
  );

  return (
    <Animated.View
      pointerEvents={isTop ? "auto" : "none"}
      style={[
        styles.cardContainer,
        {
          top: depth * CARD_OFFSET,
          left: depth * CARD_OFFSET,
          right: depth * CARD_OFFSET,
          bottom: depth * CARD_OFFSET,
          zIndex: MAX_VISIBLE_CARDS - depth
        },
        isTop
          ? {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { rotate: rotation },
                { scaleX: flipScaleX }
              ]
            }
          : null
      ]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      <View style={styles.cardSurface}>
        <View style={styles.coverWrap}>
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.placeholderText}>NO COVER</Text>
            </View>
          )}
          <View style={styles.coverTint} />
        </View>

        <View style={[styles.cardContent, isTop ? styles.cardContentTopCard : null]}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {displayCard.item.title}
          </Text>
          <Text style={styles.cardAuthor} numberOfLines={1}>
            {displayCard.item.author}
          </Text>
          <Text style={styles.cardMeta}>
            {formatSource(displayCard.item.source)} | confidence {displayCard.item.confidence.toFixed(3)}
          </Text>
          {displayCard.candidateCount > 1 ? (
            <Text style={styles.cardMeta}>
              match {displayCard.candidateIndex + 1} of {displayCard.candidateCount}
            </Text>
          ) : null}
        </View>

        {isTop ? (
          <>
            <View style={styles.captureBadge}>
              <Text style={styles.captureBadgeText}>{displayCard.captureNumber}</Text>
            </View>

            <Animated.View style={[styles.decisionPill, styles.rejectPill, { opacity: rejectOpacity }]}>
              <Text style={styles.decisionPillText}>DISAPPROVE</Text>
            </Animated.View>
            <Animated.View style={[styles.decisionPill, styles.approvePill, { opacity: approveOpacity }]}>
              <Text style={styles.decisionPillText}>APPROVE</Text>
            </Animated.View>

            <View style={styles.actionRow}>
              <Pressable onPress={reject} style={[styles.actionButton, styles.rejectButton]}>
                <DeclineBookIcon width={30} height={30} color="#55656B" />
              </Pressable>
              <Pressable onPress={approve} style={[styles.actionButton, styles.approveButton]}>
                <AcceptBookIcon width={30} height={30} color="#55656B" />
              </Pressable>
            </View>
          </>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function BookApprovalStack({ cards, onApprove, onReject }: BookApprovalStackProps) {
  const visibleCards = cards.slice(0, MAX_VISIBLE_CARDS);
  const renderOrder = [...visibleCards].reverse();

  return (
    <View style={styles.stackWrap}>
      <View style={styles.stackFrame}>
        {renderOrder.map((card, reverseIndex) => {
          const depth = visibleCards.length - reverseIndex - 1;
          return (
            <SwipeDecisionCard
              key={card.spineId}
              card={card}
              depth={depth}
              isTop={depth === 0}
              onApprove={onApprove}
              onReject={onReject}
            />
          );
        })}
      </View>
      <Text style={styles.hintText}>Swipe right to approve, left to disapprove.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stackWrap: {
    flex: 1,
    gap: 14
  },
  stackFrame: {
    flex: 1,
    minHeight: 420
  },
  cardContainer: {
    position: "absolute"
  },
  cardSurface: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    shadowColor: colors.black,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16,
    elevation: 5
  },
  coverWrap: {
    flex: 1.05,
    backgroundColor: colors.surfaceMuted,
    position: "relative"
  },
  coverImage: {
    width: "100%",
    height: "100%"
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted
  },
  placeholderText: {
    color: colors.textMuted,
    fontWeight: "700",
    letterSpacing: 1
  },
  coverTint: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.18)"
  },
  cardContent: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 5
  },
  cardContentTopCard: {
    paddingBottom: 96
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textPrimary
  },
  cardAuthor: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textSecondary
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted
  },
  decisionPill: {
    position: "absolute",
    top: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2
  },
  approvePill: {
    right: 18,
    borderColor: "#34c759",
    backgroundColor: "rgba(52, 199, 89, 0.92)"
  },
  rejectPill: {
    left: 18,
    borderColor: "#ff5e57",
    backgroundColor: "rgba(255, 94, 87, 0.92)"
  },
  decisionPillText: {
    color: colors.white,
    fontWeight: "800",
    letterSpacing: 0.5
  },
  captureBadge: {
    position: "absolute",
    top: 18,
    alignSelf: "center",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  captureBadgeText: {
    color: "#55656B",
    fontWeight: "800",
    fontSize: 14
  },
  actionRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 14,
    flexDirection: "row",
    justifyContent: "center",
    gap: 18
  },
  actionButton: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white
  },
  rejectButton: {
    borderColor: colors.white
  },
  approveButton: {
    borderColor: colors.white
  },
  hintText: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 13
  }
});
