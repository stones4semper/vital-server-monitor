import React from 'react';
import { View, Text } from 'react-native';
import LogoIcon from './LogoIcon';

export default function TitleWithLogo({ title, size = 18, color = '#0C1222' }) {
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center' }}>
			<LogoIcon size={size} />
			<Text style={{ marginLeft: 8, fontWeight: '700', fontSize: 16, color }}>{title}</Text>
		</View>
	);
}
