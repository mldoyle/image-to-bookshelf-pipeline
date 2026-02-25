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
import { fontFamilies } from "../theme/tokens";
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
  onRejectCandidate: (spineId: string) => void;
  onSkipSpine: (spineId: string) => void;
  onSwipeStateChange?: (isSwiping: boolean) => void;
};

type SwipeDecisionCardProps = {
  card: ReviewStackCard;
  depth: number;
  isTop: boolean;
  onApprove: (spineId: string) => void;
  onRejectCandidate: (spineId: string) => void;
  onSkipSpine: (spineId: string) => void;
  onSwipeStateChange?: (isSwiping: boolean) => void;
};

const MAX_VISIBLE_CARDS = 3;
const CARD_OFFSET = 8;
const SWIPE_THRESHOLD = 72;
const SWIPE_VELOCITY_THRESHOLD = 0.34;
const EXIT_DISTANCE = Dimensions.get("window").width * 1.08;

const normalizeCoverUri = (uri?: string): string | undefined => {
  if (!uri) {
    return undefined;
  }
  return uri.replace(/^http:\/\//i, "https://");
};

function SwipeDecisionCard({
  card,
  depth,
  isTop,
  onApprove,
  onRejectCandidate,
  onSkipSpine,
  onSwipeStateChange
}: SwipeDecisionCardProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const flipScaleX = useRef(new Animated.Value(1)).current;
  const animatingRef = useRef(false);
  const swipeActiveRef = useRef(false);
  const [displayCard, setDisplayCard] = useState(card);

  useEffect(() => {
    if (displayCard.item.id === card.item.id) {
      return;
    }

    if (!isTop) {
      setDisplayCard(card);
      return;
    }

    Animated.sequence([
      Animated.timing(flipScaleX, {
        toValue: 0,
        duration: 105,
        useNativeDriver: true
      }),
      Animated.timing(flipScaleX, {
        toValue: 1,
        duration: 125,
        useNativeDriver: true
      })
    ]).start();
    setDisplayCard(card);
  }, [card, displayCard.item.id, flipScaleX, isTop]);

  const rotation = pan.x.interpolate({
    inputRange: [-220, 0, 220],
    outputRange: ["-7deg", "0deg", "7deg"],
    extrapolate: "clamp"
  });

  const settleToCenter = () => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      tension: 68,
      friction: 7,
      useNativeDriver: true
    }).start();
  };

  const setSwipeActive = (isSwiping: boolean) => {
    if (swipeActiveRef.current === isSwiping) {
      return;
    }
    swipeActiveRef.current = isSwiping;
    onSwipeStateChange?.(isSwiping);
  };

  const approve = () => {
    if (!isTop || animatingRef.current) {
      return;
    }
    animatingRef.current = true;
    Animated.parallel([
      Animated.timing(pan.x, {
        toValue: EXIT_DISTANCE,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(pan.y, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(() => {
      pan.setValue({ x: 0, y: 0 });
      animatingRef.current = false;
      onApprove(card.spineId);
    });
  };

  const skipSpine = () => {
    if (!isTop || animatingRef.current) {
      return;
    }
    animatingRef.current = true;
    Animated.parallel([
      Animated.timing(pan.x, {
        toValue: -EXIT_DISTANCE,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(pan.y, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(() => {
      pan.setValue({ x: 0, y: 0 });
      animatingRef.current = false;
      onSkipSpine(card.spineId);
    });
  };

  const rejectCandidate = () => {
    if (!isTop || animatingRef.current) {
      return;
    }
    animatingRef.current = true;
    onRejectCandidate(card.spineId);
    setTimeout(() => {
      animatingRef.current = false;
    }, 180);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          const shouldSet =
            isTop &&
            !animatingRef.current &&
            Math.abs(gestureState.dx) > 6 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15;
          if (shouldSet) {
            setSwipeActive(true);
          }
          return shouldSet;
        },
        onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
          isTop &&
          !animatingRef.current &&
          Math.abs(gestureState.dx) > 6 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_event, gestureState) => {
          pan.setValue({ x: gestureState.dx, y: gestureState.dy * 0.1 });
        },
        onPanResponderRelease: (_event, gestureState) => {
          setSwipeActive(false);
          if (gestureState.dx > SWIPE_THRESHOLD || gestureState.vx > SWIPE_VELOCITY_THRESHOLD) {
            approve();
            return;
          }
          if (gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -SWIPE_VELOCITY_THRESHOLD) {
            skipSpine();
            return;
          }
          settleToCenter();
        },
        onPanResponderTerminate: () => {
          setSwipeActive(false);
          settleToCenter();
        }
      }),
    [approve, isTop, onSwipeStateChange, pan, skipSpine]
  );

  useEffect(() => {
    return () => {
      setSwipeActive(false);
    };
  }, []);

  const coverUri = normalizeCoverUri(
    displayCard.item.metadata?.imageLinks?.thumbnail ?? displayCard.item.metadata?.imageLinks?.smallThumbnail
  );

  return (
    <Animated.View
      pointerEvents={isTop ? "auto" : "none"}
      style={[
        styles.cardContainer,
        {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
          : {
              transform: [
                { translateX: depth * CARD_OFFSET },
                { translateY: -depth * 3 }
              ]
            }
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

          <View style={styles.coverShade} />

          <View style={styles.metaOverlay}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {displayCard.item.title}
            </Text>
            <Text style={styles.cardAuthor} numberOfLines={1}>
              {displayCard.item.author}
            </Text>
          </View>

          {displayCard.candidateCount > 1 ? (
            <View style={styles.candidatePill}>
              <Text style={styles.candidateText}>
                {displayCard.candidateIndex + 1}/{displayCard.candidateCount}
              </Text>
            </View>
          ) : null}

          {isTop ? (
            <View style={styles.actionRow}>
              <Pressable style={[styles.actionButton, styles.rejectButton]} onPress={rejectCandidate}>
                <DeclineBookIcon width={16} height={16} color="#F8EBE0" />
              </Pressable>
              <Pressable style={[styles.actionButton, styles.approveButton]} onPress={approve}>
                <AcceptBookIcon width={16} height={16} color="#2E3448" />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

export function BookApprovalStack({
  cards,
  onApprove,
  onRejectCandidate,
  onSkipSpine,
  onSwipeStateChange
}: BookApprovalStackProps) {
  const visibleCards = cards.slice(0, MAX_VISIBLE_CARDS);
  const renderOrder = [...visibleCards].reverse();

  return (
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
            onRejectCandidate={onRejectCandidate}
            onSkipSpine={onSkipSpine}
            onSwipeStateChange={onSwipeStateChange}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stackFrame: {
    height: 278,
    position: "relative"
  },
  cardContainer: {
    position: "absolute"
  },
  cardSurface: {
    flex: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.22)",
    overflow: "hidden",
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 4
  },
  coverWrap: {
    flex: 1,
    backgroundColor: colors.surfaceMuted
  },
  coverImage: {
    width: "100%",
    height: "100%"
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  placeholderText: {
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.7
  },
  coverShade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(15,18,29,0.22)"
  },
  metaOverlay: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 34,
    gap: 1
  },
  cardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.serifRegular,
    fontSize: 18,
    lineHeight: 20
  },
  cardAuthor: {
    color: "rgba(245,237,224,0.84)",
    fontSize: 15,
    lineHeight: 18
  },
  candidatePill: {
    position: "absolute",
    right: 8,
    top: 8,
    minWidth: 36,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,23,34,0.68)",
    borderWidth: 1,
    borderColor: "rgba(212,165,116,0.24)"
  },
  candidateText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "700"
  },
  actionRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8
  },
  actionButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1
  },
  rejectButton: {
    backgroundColor: "#C45B5B",
    borderColor: "rgba(244,196,189,0.55)"
  },
  approveButton: {
    backgroundColor: colors.accent,
    borderColor: "rgba(20,23,34,0.35)"
  }
});
