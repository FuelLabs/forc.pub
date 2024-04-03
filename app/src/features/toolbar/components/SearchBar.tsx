import React from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import InputAdornment from '@mui/material/InputAdornment/InputAdornment';
import Input from '@mui/material/Input/Input';
import SearchIcon from '@mui/icons-material/Search';

function SearchBar() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const {pathname} = useLocation();


  return (
    <div
      style={{
        marginLeft: isMobile ? 0 : '25px',
        marginRight: '15px',
        height: '70%',
        width: '100%',
      }}>
      <Input
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'lightGrey',
        }}
        startAdornment={
          <InputAdornment position='start' style={{ marginLeft: '10px' }}>
            <SearchIcon />
          </InputAdornment>
        }
        placeholder='Search packages and plugins'
        inputProps={{ 'aria-label': 'search' }}
        onChange={(e) => {
            const newSearch = e.currentTarget.value;

            if (!newSearch.length) {
                if (pathname === '/search') {
                    navigate('/');
                }
                searchParams.delete('q');
                setSearchParams(searchParams);
            } else {
                if (pathname !== '/search') {
                    navigate('/search');
                }
                searchParams.set('q', newSearch);
                setSearchParams(searchParams);    
            }
        }}
      />
    </div>
  );
}

export default SearchBar;
