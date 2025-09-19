import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, G, Circle } from 'react-native-svg';

export default function LogoIcon({ size = 128, rounded = 32 }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 1024 1024">
			<Defs>
				<LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
					<Stop offset="0%" stopColor="#0C1222"/>
					<Stop offset="100%" stopColor="#16324A"/>
				</LinearGradient>
				<LinearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
					<Stop offset="0%" stopColor="#6AE6FF"/>
					<Stop offset="100%" stopColor="#18E299"/>
				</LinearGradient>
			</Defs>

			<Rect x="64" y="64" width="896" height="896" rx={220} ry={220} fill="url(#bg)" />
			<Rect x="232" y="248" width="560" height="528" rx="42" ry="42" fill="none" stroke="#1AC8A5" strokeWidth="12" opacity="0.75"/>

			<G stroke="#1AC8A5" strokeWidth="12" opacity="0.55">
				<Path d="M312 232v-36 M384 232v-36 M456 232v-36 M528 232v-36 M600 232v-36 M672 232v-36" />
				<Path d="M312 828v36 M384 828v36 M456 828v36 M528 828v36 M600 828v36 M672 828v36" />
				<Path d="M216 332h-36 M216 404h-36 M216 476h-36 M216 548h-36 M216 620h-36 M216 692h-36" />
				<Path d="M808 332h36 M808 404h36 M808 476h36 M808 548h36 M808 620h36 M808 692h36" />
			</G>

			<Path
				d="M180 640 L260 640 L300 560 L350 720 L430 480 L480 610 L520 560 L600 720 L660 520 L720 620 L844 620"
				fill="none" stroke="url(#wave)" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round"
			/>
			<Circle cx="600" cy="720" r="10" fill="#18E299"/>
		</Svg>
	);
}
