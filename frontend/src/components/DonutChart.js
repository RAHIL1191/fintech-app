import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';

const DonutChart = ({
    data = [], // Array of { value, color }
    total = 0,
    size = 200,
    strokeWidth = 25,
    centerLabel = "Expenses",
    centerValue = "$0.00"
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const halfSize = size / 2;

    const validData = data.filter(d => d.value > 0);
    const calculatedTotal = validData.reduce((acc, curr) => acc + curr.value, 0) || 1; // Prevent div by 0

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={StyleSheet.absoluteFill}>
                <G rotation={-90} origin={`${halfSize}, ${halfSize}`}>
                    {/* Background */}
                    <Circle
                        cx={halfSize}
                        cy={halfSize}
                        r={radius}
                        stroke="#111827"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                    />

                    {validData.map((item, index) => {
                        // Calculate cumulative percentage of PREVIOUS items to determine rotation
                        const previousTotal = validData.slice(0, index).reduce((acc, curr) => acc + curr.value, 0);
                        const startPct = previousTotal / calculatedTotal;
                        const rotation = startPct * 360;

                        const percentage = item.value / calculatedTotal;
                        const strokeLength = circumference * percentage;

                        return (
                            <Circle
                                key={index}
                                cx={halfSize}
                                cy={halfSize}
                                r={radius}
                                stroke={item.color}
                                strokeWidth={strokeWidth}
                                fill="transparent"
                                strokeDasharray={[strokeLength, circumference - strokeLength]}
                                strokeLinecap="round"
                                rotation={rotation}
                                origin={`${halfSize}, ${halfSize}`}
                            />
                        )
                    })}
                </G>
            </Svg>

            {/* Center Text */}
            <View style={styles.centerLabel}>
                <Text style={styles.labelText}>{centerLabel}</Text>
                <Text style={styles.valueText}>{centerValue}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerLabel: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    labelText: {
        color: '#9CA3AF', // zinc-400
        fontSize: 14,
        marginBottom: 4,
    },
    valueText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
    }
});

export default DonutChart;
