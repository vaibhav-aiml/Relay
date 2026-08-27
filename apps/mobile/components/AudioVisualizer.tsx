import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';

type VisualizerMode = 'idle' | 'listening' | 'speaking';
type VisualizerSize = 'compact' | 'large';

interface AudioVisualizerProps {
  mode: VisualizerMode;
  size?: VisualizerSize;
}

const BAR_COUNT = 7;

const MODE_COLORS: Record<VisualizerMode, string> = {
  idle: '#475569',
  listening: '#ef4444',
  speaking: '#818cf8',
};

const SIZE_CONFIG = {
  compact: {
    height: 32,
    barWidth: 3,
    barGap: 3,
    maxBarHeight: 24,
    minBarHeight: 4,
    borderRadius: 1.5,
  },
  large: {
    height: 120,
    barWidth: 6,
    barGap: 6,
    maxBarHeight: 100,
    minBarHeight: 8,
    borderRadius: 3,
  },
};

/**
 * Animated audio waveform visualizer component.
 *
 * Shows oscillating bars that simulate an audio waveform in three modes:
 * - idle: Flat bars with subtle opacity pulse
 * - listening: Red bars with moderate amplitude (during STT recording)
 * - speaking: Indigo/purple bars with full amplitude and staggered timing (during TTS playback)
 */
export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  mode,
  size = 'compact',
}) => {
  const config = SIZE_CONFIG[size];
  const color = MODE_COLORS[mode];
  const isActive = mode !== 'idle';

  // Create animated values for each bar
  const barAnimations = useRef<Animated.Value[]>(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0)),
  ).current;

  // Opacity for idle pulse
  const idleOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (mode === 'idle') {
      // Stop bar animations, reset to base
      barAnimations.forEach((anim) => {
        anim.stopAnimation();
        anim.setValue(0);
      });

      // Subtle idle opacity pulse
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(idleOpacity, {
            toValue: 0.7,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(idleOpacity, {
            toValue: 0.4,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();

      return () => pulse.stop();
    }

    // Active mode — animate bars with staggered timing
    idleOpacity.setValue(1);

    const animations = barAnimations.map((anim, index) => {
      // Stagger: center bars are tallest and fastest
      const centerDistance = Math.abs(index - Math.floor(BAR_COUNT / 2));
      const amplitude = mode === 'speaking' ? 1 - centerDistance * 0.12 : 0.6 - centerDistance * 0.08;
      const speed = mode === 'speaking' ? 300 + centerDistance * 80 : 400 + centerDistance * 100;

      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: Math.max(0.15, amplitude),
            duration: speed + Math.random() * 100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false, // height requires layout
          }),
          Animated.timing(anim, {
            toValue: 0.05 + Math.random() * 0.1,
            duration: speed + Math.random() * 100,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: false,
          }),
        ]),
      );
    });

    // Start with stagger
    animations.forEach((anim, index) => {
      setTimeout(() => anim.start(), index * 60);
    });

    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, [mode]);

  const totalWidth =
    BAR_COUNT * config.barWidth + (BAR_COUNT - 1) * config.barGap;

  return (
    <Animated.View
      style={[
        styles.container,
        { height: config.height, width: totalWidth, opacity: isActive ? 1 : idleOpacity },
      ]}
    >
      {barAnimations.map((anim, index) => {
        const barHeight = isActive
          ? anim.interpolate({
              inputRange: [0, 1],
              outputRange: [config.minBarHeight, config.maxBarHeight],
            })
          : config.minBarHeight;

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                width: config.barWidth,
                height: barHeight,
                borderRadius: config.borderRadius,
                backgroundColor: color,
                marginHorizontal: config.barGap / 2,
              },
            ]}
          />
        );
      })}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    // Base styles — dimensions set dynamically
  },
});
