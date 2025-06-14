import type { Chore } from '@customTypes/SharedTypes';

type NavBarProps = {
    categories: string[];
    selectedCategory: string;
    onClick: (category: string) => void;
};

function NavBar({ categories, selectedCategory, onClick }: NavBarProps) {
    return (
        <div id="NavBar" className="border-b border-gray-700">
            <div className="container mx-auto flex space-x-1">
                <button
                    key="all"
                    className={`px-6 py-4 font-medium flex items-center ${selectedCategory === "all" ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}
                    onClick={() => onClick("all")}
                >
                    All
                </button>
                {categories.map((category: string, i: number) => (
                    <button
                        key={i}
                        className={`px-6 py-4 font-medium flex items-center ${selectedCategory === category ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-gray-400 hover:text-gray-200'}`}
                        onClick={() => onClick(category)}
                    >
                        {category}
                    </button>
                ))}
            </div>
        </div>
    )
}

export default NavBar;